"""Build partial learnsets, not fixed four-move rentals, from cached PokeAPI CSVs.

Only ordinary learning in one mainline version group is admitted. The final
compiler derives feasible tactical plans; live entities choose their four moves.
"""
from pathlib import Path
import csv, json, re, subprocess

ROOT = Path(__file__).resolve().parents[2]
GROUPS = {8, 9, 10, 11, 14, 15, 16, 17, 18, 20, 21, 22, 23, 25, 26, 27}
SUPPORT = set('swordsdance dragondance calmmind quiverdance agility howl recover roost moonlight stealthrock thunderwave willowisp sleeppowder toxic leechseed encore yawn protect reflect lightscreen raindance sunnyday sandstorm electricterrain tailwind roar whirlwind'.split())
SIGNATURES = {1017: 'ivycudgel', 911: 'torchsong', 959: 'gigatonhammer', 983: 'kowtowcleave', 647: 'secretsword'}
UTILITY = set('knockoff rapidspin icywind mudshot rocktomb chargebeam torchsong gigadrain drainpunch'.split())

def ident(s): return re.sub('[^a-z0-9]', '', s.lower())
def rows(name):
    with (ROOT / 'data/sources' / (name + '.csv')).open(encoding='utf-8-sig', newline='') as f:
        yield from csv.DictReader(f)

def build():
    data = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify({bases:require('./data/species.json').sets,meta:require('./src/data/meta.js'),info:require('./src/data/info.js')}))"], cwd=ROOT))
    bases, meta, info = data['bases'], data['meta'], data['info']
    moves = meta['moves']
    mids = {r['id']: ident(r['identifier']) for r in rows('moves')}
    mids = {n: ('vicegrip' if k == 'visegrip' else k) for n, k in mids.items()}
    supported = {k for k, m in moves.items() if m['category'] != 'Status' or k in SUPPORT} - {'struggle'}
    pids = {int(r['species_id']): int(r['id']) for r in rows('pokemon') if r['is_default'] == '1'}
    groups = {int(r['id']): r for r in rows('version_groups')}
    learn = {pids[b['num']]: {} for b in bases}
    for r in rows('pokemon_moves'):
        p, g, method = int(r['pokemon_id']), int(r['version_group_id']), int(r['pokemon_move_method_id'])
        k = mids[r['move_id']]
        if p not in learn or g not in GROUPS or method not in {1, 2, 3, 4} or k not in supported: continue
        proof = dict(moveId=int(r['move_id']), method=method, level=int(r['level']))
        options = learn[p].setdefault(g, {}).setdefault(k, [])
        if proof not in options: options.append(proof)

    ability_ids = {r['id']: ident(r['identifier']) for r in rows('abilities')}
    ability_gen = {ident(r['identifier']): int(r['generation_id']) for r in rows('abilities')}
    ability_zh = {ability_ids[r['ability_id']]: r['name'] for r in rows('ability_names') if r['local_language_id'] == '12'}
    current = {p: [] for p in learn}
    for r in rows('pokemon_abilities'):
        p, a = int(r['pokemon_id']), ability_ids[r['ability_id']]
        if p in current and r['is_hidden'] == '0': current[p].append(a)
    # Showdown mod tables override ordinary slots as we walk back from Gen IX.
    historical = {}
    for gen in [8, 7, 6, 5, 4]:
        overrides = {}
        for key, body in re.findall(r'^\t(\w+): \{(.*?)^\t\},', (ROOT / f'data/sources/gen{gen}-pokedex.ts').read_text(encoding='utf8'), re.M | re.S):
            match = re.search(r'abilities:\s*\{([^}]+)\}', body)
            if match:
                ordinary = [ident(a) for a in re.findall(r'(?:^|,)\s*[01]:\s*"([^"]+)"', match[1])]
                if ordinary: overrides[key] = ordinary
        historical[gen] = overrides
    item_ids = {r['id']: ident(r['identifier']) for r in rows('items')}
    item_zh = {item_ids[r['item_id']]: r['name'] for r in rows('item_names') if r['local_language_id'] == '12'}
    nature_ids = {r['id']: r['identifier'].title() for r in rows('natures')}
    nature_zh = {nature_ids[r['nature_id']]: r['name'] for r in rows('nature_names') if r['local_language_id'] == '12'}
    raw = {}
    for b in bases:
        num, pid, key = b['num'], pids[b['num']], ident(b['species'])
        spec = meta['species'][key]; st, types = spec['baseStats'], spec['types']
        cohorts = []
        for g, legal in sorted(learn[pid].items(), reverse=True):
            gen = int(groups[g]['generation_id'])
            abilities = current[pid][:]
            for past in range(8, gen - 1, -1):
                abilities = historical.get(past, {}).get(key, abilities)
            abilities = [a for a in abilities if a in info['abilities'] and ability_gen[a] <= gen]
            if not abilities: continue
            signature = SIGNATURES.get(num, '')
            if signature and signature not in legal: continue
            def power(k):
                m = moves[k]
                return {'grassknot': 80, 'magnitude': 71, 'nightshade': 55}.get(k, m['power'] * (3 if k in {'bulletseed', 'rockblast', 'doubleslap'} else 2 if k in {'doublekick', 'twineedle'} else 1))
            def score(k):
                m = moves[k]; ratio = st['atk' if m['category'] == 'Physical' else 'spa'] / max(st['atk'], st['spa'])
                return power(k) * (1 if m['accuracy'] is True else m['accuracy'] / 100) * ratio + (20 if m['type'] in types else 0) + (18 if m['priority'] > 0 else 0) + (16 if k in UTILITY else 0) + (100 if k == signature else 0) - (28 if k == 'dig' else 0)
            attacks = sorted((k for k in legal if moves[k]['category'] != 'Status' and k not in {'wrap', 'fakeout'}), key=lambda k: (-score(k), k))
            selected, per_type = [], {}
            for k in attacks:
                m = moves[k]; cat = m['category']; bucket = (cat, m['type'])
                best = max(power(x) for x in attacks if moves[x]['category'] == cat and moves[x]['type'] == m['type'])
                useful = m['priority'] > 0 or k in UTILITY or k == signature
                if power(k) < min(best, 100) * .6 and not useful: continue
                if per_type.get(bucket, 0) >= 2 and not useful: continue
                selected.append(k); per_type[bucket] = per_type.get(bucket, 0) + 1
            # Each attack direction gets its own compact pool. Mixed is available
            # only when both base attacking stats genuinely support it.
            lanes = []
            for mode in ['Physical', 'Special', 'Mixed']:
                stat = st['atk'] if mode == 'Physical' else st['spa']
                if mode == 'Mixed':
                    if min(st['atk'], st['spa']) < 70 or min(st['atk'], st['spa']) < max(st['atk'], st['spa']) * .8: continue
                elif stat < max(st['atk'], st['spa']) * .65: continue
                choices = [k for k in selected if mode == 'Mixed' or moves[k]['category'] == mode or k == 'nightshade'][:24]
                if len(choices) < 2 or (signature and signature not in choices): continue
                lanes.append(dict(mode=mode, attacks=choices))
            if not lanes: continue
            support = sorted(set(legal) & SUPPORT)
            eggs = sorted(k for k, proof in legal.items() if all(x['method'] == 2 for x in proof))
            cohort = dict(version=g, generation=gen, abilities=abilities, support=support, egg=eggs, signature=signature, lanes=lanes)
            fingerprint = json.dumps([abilities, support, eggs, lanes], sort_keys=True)
            if any(c['_fingerprint'] == fingerprint for c in cohorts): continue
            cohort['_fingerprint'] = fingerprint; cohorts.append(cohort)
        # Prefer recent mainline legality; retain older pools only if they add
        # useful alternatives. No transfer-only or event-exclusive move mixing.
        chosen = []
        covered = set()
        for c in cohorts:
            keys = set(c['support']) | {k for lane in c['lanes'] for k in lane['attacks']}
            if chosen and not (keys - covered): continue
            del c['_fingerprint']; chosen.append(c); covered |= keys
            if len(chosen) == 3: break
        if not chosen: raise ValueError(f'No legal partial learnset: {num} {b["name"]}')
        raw[str(num)] = dict(cohorts=chosen)
    from division_policy import classify
    classification = classify(bases)
    payload = dict(schema=1, species=raw, divisionPolicy=classification, itemNames={k: v for k, v in item_zh.items() if k in info['items']}, abilityNames=ability_zh, natureNames=nature_zh)
    subprocess.run(['node', 'scripts/data/compile-rental-pools.cjs'], input=json.dumps(payload).encode('utf8'), cwd=ROOT, check=True)

if __name__ == '__main__': build()
