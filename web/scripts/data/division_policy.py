"""Classify rental species by evolution stage and configured exceptions."""
from pathlib import Path
import copy, csv, json, re

ROOT = Path(__file__).resolve().parents[2]

def classify(bases):
    policy = json.loads((ROOT / 'data/config/division-policy.json').read_text(encoding='utf8'))
    with (ROOT / 'data/sources/pokemon_species.csv').open(encoding='utf-8-sig', newline='') as f:
        species = {int(r['id']): r for r in csv.DictReader(f)}
    ignored = {(x['parent'], x['child']) for x in policy['ignoredEvolutionEdges']}
    children = {}
    for num, s in species.items():
        parent = int(s['evolves_from_species_id'] or 0)
        if parent and (parent, num) not in ignored: children.setdefault(parent, []).append(num)
    assignments = {}
    for base in bases:
        num = base['num']; s = species[num]
        parent = int(s['evolves_from_species_id'] or 0)
        child = sorted(children.get(num, []))
        stage = 'middle' if parent and child else 'base' if child else 'final' if parent else 'single'
        ability = re.sub('[^a-z0-9]', '', base['ability'].lower())
        special = s['is_legendary'] == '1' or s['is_mythical'] == '1' or ability in policy['specialAbilities']
        pool = 4 if special else 2 if stage == 'middle' else 1 if stage == 'base' else 3
        reason = '传说／幻之／特殊类别' if special else {'middle': '有前置形态且仍可继续进化', 'base': '仍可进化的初始形态', 'final': '普通最终进化形态', 'single': '普通独立物种'}[stage]
        standard_reason = policy.get('standardFinals', {}).get(str(num))
        if standard_reason:
            if stage != 'final' or special or base['bst'] > policy['standardFinalMaxBST']:
                raise ValueError(f'Invalid standard final-evolution exception: {num}')
            if str(num) in policy['overrides']:
                raise ValueError(f'Conflicting division exceptions: {num}')
            pool, reason = 2, standard_reason
        override = policy['overrides'].get(str(num))
        if override: pool, reason = override['pool'], override['reason']
        if pool == 2 and stage != 'middle' and not standard_reason:
            raise ValueError(f'Standard tier needs a middle evolution or explicit final exception: {num}')
        assignments[str(num)] = dict(pool=pool, stage=stage, parent=parent or None, children=child, reason=reason, previousPool=base['pool'])
    divisions = copy.deepcopy(policy['divisions'])
    for d in divisions:
        d['count'] = sum(row['pool'] == d['id'] for row in assignments.values())
        for num in d['samples']:
            if assignments.get(str(num), {}).get('pool') != d['id']: raise ValueError(f'Out-of-pool sample: {d["id"]}/{num}')
    return dict(version=policy['version'], divisions=divisions, species=assignments)
