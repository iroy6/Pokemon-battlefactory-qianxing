# 对战规则核查（2026-10-17）

本项目采用第九世代《朱／紫》的回合制单打规则。现有 332 种宝可梦和 214 个招式保留；已经退出新作的招式、道具按最后可用的回合制效果处理。《传说 阿尔宙斯》《传说 Z-A》和《Pokémon Champions》的独立规则不混入本规则集。租借招式组合仍来自项目已有的各作品学习记录，不代表严格的《朱／紫》参赛合法性。

交换界面直接公开对方四个招式与 PP、特性、道具、性格、能力值；是否在战斗中出现或发动不影响查看。战斗 AI 仍只使用公开的战斗情报。

## 资料来源与修改

下列描述为项目独立撰写的实现摘要；链接用于核对事实。

| 范围 | 当前处理 | 神奇宝贝百科来源 |
| --- | --- | --- |
| 麻痹 | 速度减半；25% 无法行动；电属性免疫；魔法防守不免疫行动限制 | [麻痹](https://wiki.52poke.com/wiki/麻痹（状态）) |
| 灼伤、硬撑 | 每回合扣 1/16 HP；硬撑忽略灼伤的伤害削减 | [灼伤](https://wiki.52poke.com/wiki/灼伤（状态）) |
| 睡眠、混乱 | 睡眠通常阻止 1～3 次行动；混乱自伤概率 1/3 | [睡眠](https://wiki.52poke.com/wiki/睡眠（状态）)、[混乱](https://wiki.52poke.com/wiki/混乱（状态）) |
| 要害 | 伤害 ×1.5，概率为 1/24、1/8、1/2、必定 | [击中要害](https://wiki.52poke.com/wiki/击中要害) |
| 结实、气势披带 | 保护满 HP 时的单次致命攻击；连续招式后续命中仍可击倒 | [结实](https://wiki.52poke.com/wiki/结实（特性）)、[气势披带](https://wiki.52poke.com/wiki/气势披带) |
| 扬沙 | 5 回合天气，离场不取消 | [扬沙](https://wiki.52poke.com/wiki/扬沙（特性）) |
| 精神力、我行我素、锐利目光、引火 | 威吓免疫、忽略闪避提升、冰冻时仍吸收火招式 | [精神力](https://wiki.52poke.com/wiki/精神力（特性）)、[锐利目光](https://wiki.52poke.com/wiki/锐利目光（特性）)、[引火](https://wiki.52poke.com/wiki/引火（特性）) |
| 同步、神秘守护 | 同步保留剧毒；神秘守护阻止同步；不阻止既有哈欠和接触特性 | [同步](https://wiki.52poke.com/wiki/同步（特性）)、[神秘守护](https://wiki.52poke.com/wiki/神秘守护（状态）) |
| 守住、看穿 | 优先度 +4，连续成功率除以 3，最低 1/729 | [守住](https://wiki.52poke.com/wiki/守住（招式）) |
| 拍落、高速旋转 | 拍落 65 威力，持有可移除道具时额外 ×1.5；高速旋转 50 威力并加速 | [拍落](https://wiki.52poke.com/wiki/拍落（招式）)、[高速旋转](https://wiki.52poke.com/wiki/高速旋转（招式）) |
| 王者之证、锐利之牙、天恩 | 无自带畏缩的攻击逐击判定 10%，天恩提高至 20%，不叠加原有畏缩 | [王者之证](https://wiki.52poke.com/wiki/王者之证（道具）) |
| 束缚、玩水/玩泥 | 束缚 4～5 回合扣 1/8 HP；玩水/玩泥持续 5 回合、威力降至 1/3、换下不解除 | [束缚](https://wiki.52poke.com/wiki/束缚（状态）)、[玩水](https://wiki.52poke.com/wiki/玩水（招式）) |
| 巨力锤 | 已被再来一次锁定时，不能选择的回合使用挣扎；行动前才被锁定可连续使用 | [巨力锤](https://wiki.52poke.com/wiki/巨力锤（招式）) |

还同步了招式的威力、命中、PP、优先度、属性、接触/粉末/保护标记，顺风 4 回合、定身法 4 次行动、再来一次 3 次行动、变小与甜甜香气两级变化、毒牙 50% 剧毒、连续攻击次数概率、草属性粉末免疫与幽灵属性脱离束缚，以及现代物种能力值和属性相性。

## 可重复构建

数值与标记交叉核对 [Pokémon Showdown](https://github.com/smogon/pokemon-showdown/tree/master/data) 的 Gen IX 默认数据。缓存为 `web/data/sources/current-{moves,pokedex,abilities,items}.ts`；源 URL、获取日期和 SHA-256 记在该目录的 `manifest.json`。主分支以后的变化不会自动进入当前构建。

```sh
node web/scripts/data/update-modern-meta.cjs
npm run build:data
npm test
npm run build:lua
npm run build:web
npm run build:qianxing
npm run test:runtime
```

`update-modern-meta.cjs` 只导入已经支持的招式和物种。效果逻辑仍由 `web/src/game/engine.js` 实现，并不直接运行第三方战斗引擎。`build:lua` 同步生成模拟器和千星版核心，保留千星模块入口；平台 UI/素材分别维护。

## 验证边界

- 原有规则测试改为现代预期；新增覆盖代际差异及交换全部资料的用例。
- 使用项目的模拟器和 GIA 校验脚本检查手机、PC 的启动、租借、对战、资料、队伍及记录界面。
- 本次未取得千星真机试玩证据，GIA 属于经过模拟器验证的候选包。
