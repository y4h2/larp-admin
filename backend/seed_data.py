"""Seed script to populate the database with test data."""

import asyncio
from uuid import uuid4
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker


async def clear_data(session: AsyncSession):
    """Clear existing data."""
    await session.execute(text("TRUNCATE TABLE clues CASCADE"))
    await session.execute(text("TRUNCATE TABLE npcs CASCADE"))
    await session.execute(text("TRUNCATE TABLE scripts CASCADE"))
    await session.commit()
    print("Cleared existing data")


async def seed_data():
    """Seed the database with test data."""
    async with async_session_maker() as session:
        # Clear existing data
        await clear_data(session)

        # ============ Script 1: 午夜庄园谜案 ============
        script1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scripts (id, title, summary, background, difficulty, truth)
            VALUES (:id, :title, :summary, :background, :difficulty, :truth)
        """), {
            "id": script1_id,
            "title": "午夜庄园谜案",
            "summary": "一个发生在维多利亚时代庄园的神秘谋杀案。富有的庄园主人被发现死于书房，所有宾客都有嫌疑...",
            "background": "1895年，英格兰乡村的布莱克伍德庄园。这座有着两百年历史的庄园近期举办了一场盛大的晚宴，却以悲剧收场。",
            "difficulty": "medium",
            "truth": json.dumps({
                "murderer": "艾德华·布莱克伍德",
                "weapon": "毒药（藏在威士忌中）",
                "motive": "遗产纠纷，管家即将被主人开除",
                "crime_method": "在主人的威士忌中下毒，趁机篡改遗嘱"
            }),
        })

        # Script 1 NPCs with knowledge_scope
        npc1_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, age, background, personality, knowledge_scope)
            VALUES (:id, :script_id, :name, :age, :background, :personality, :knowledge_scope)
        """), {
            "id": npc1_1_id,
            "script_id": script1_id,
            "name": "艾德华·布莱克伍德",
            "age": 45,
            "background": "在庄园服务了25年的管家，对庄园的每一个角落都了如指掌。表面上对主人忠心耿耿，但最近似乎有些心事...",
            "personality": "严肃、忠诚、城府深，说话慢条斯理，用词考究",
            "knowledge_scope": json.dumps({
                "knows": [
                    "庄园所有房间的布局和秘密通道",
                    "主人的日常习惯和喜好",
                    "遗嘱的存放位置",
                    "主人最近打算修改遗嘱",
                    "威士忌的存放位置"
                ],
                "does_not_know": [
                    "警方已经发现了毒药残留",
                    "花园里有目击者"
                ],
                "world_model_limits": [
                    "不会承认自己有作案动机",
                    "不会主动提及遗嘱内容",
                    "会尽量表现得忠诚和悲伤"
                ]
            }),
        })

        npc1_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, age, background, personality, knowledge_scope)
            VALUES (:id, :script_id, :name, :age, :background, :personality, :knowledge_scope)
        """), {
            "id": npc1_2_id,
            "script_id": script1_id,
            "name": "维多利亚·格林伍德",
            "age": 35,
            "background": "庄园主人唯一的亲属，一直觊觎庄园的继承权。在伦敦经营一家小型画廊，这次受邀参加晚宴...",
            "personality": "优雅、聪明、野心勃勃，说话得体但偶尔带有讽刺意味",
            "knowledge_scope": json.dumps({
                "knows": [
                    "叔叔最近身体不好",
                    "遗嘱中自己是唯一继承人",
                    "管家和叔叔最近有争执",
                    "晚宴上的宾客名单"
                ],
                "does_not_know": [
                    "遗嘱已被修改",
                    "管家的下毒计划",
                    "秘密通道的存在"
                ],
                "world_model_limits": [
                    "不会承认自己对遗产的渴望",
                    "会表现出适当的悲伤",
                    "会怀疑管家的动机"
                ]
            }),
        })

        npc1_3_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, age, background, personality, knowledge_scope)
            VALUES (:id, :script_id, :name, :age, :background, :personality, :knowledge_scope)
        """), {
            "id": npc1_3_id,
            "script_id": script1_id,
            "name": "托马斯·威尔逊",
            "age": 55,
            "background": "在庄园工作了30多年的园丁，见证了庄园的兴衰。案发当晚声称在花园修剪玫瑰...",
            "personality": "沉默寡言、观察力强、善良朴实，说话简短直接",
            "knowledge_scope": json.dumps({
                "knows": [
                    "案发当晚看到有人从书房窗户翻出",
                    "那人手里拿着发光的东西",
                    "管家最近常常神秘地进出书房",
                    "花园的所有隐蔽角落"
                ],
                "does_not_know": [
                    "遗嘱的内容",
                    "毒药的事情",
                    "谁是真正的凶手"
                ],
                "world_model_limits": [
                    "只会在被直接询问时透露看到的事情",
                    "对主人非常忠诚，不愿意冤枉任何人",
                    "不会撒谎，但可能遗漏细节"
                ]
            }),
        })

        # Script 1 Clues
        clue1_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue1_1_id,
            "script_id": script1_id,
            "npc_id": npc1_1_id,
            "name": "血迹喷溅模式",
            "type": "text",
            "detail": "书房地板上的血迹呈现出奇怪的喷溅模式，似乎暗示着受害者不是在发现的位置被杀害的。",
            "detail_for_npc": "如果被问到血迹，你会表现出困惑，说你发现主人时他已经倒在地上了，你不太清楚血迹的情况。",
            "trigger_keywords": ["血迹", "血", "地板", "地上", "喷溅"],
            "trigger_semantic_summary": "检查地板上的血迹，询问血迹的来源",
            "prereq_clue_ids": [],
        })

        clue1_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue1_2_id,
            "script_id": script1_id,
            "npc_id": npc1_1_id,
            "name": "威士忌酒杯",
            "type": "text",
            "detail": "书桌上有两个威士忌酒杯，但只有一个有唇印。另一个杯子底部有少量沉淀物。",
            "detail_for_npc": "当被问到酒杯时，你会说主人有睡前喝威士忌的习惯，两个杯子是因为原本主人约了客人一起喝酒。",
            "trigger_keywords": ["杯子", "酒杯", "威士忌", "桌子", "沉淀"],
            "trigger_semantic_summary": "询问桌上的酒杯，检查威士忌",
            "prereq_clue_ids": [],
        })

        clue1_3_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue1_3_id,
            "script_id": script1_id,
            "npc_id": npc1_2_id,
            "name": "遗嘱草稿",
            "type": "text",
            "detail": "在壁炉旁发现了一些撕碎的纸张碎片。勉强拼凑后，似乎是一份遗嘱的草稿，上面提到要将庄园留给'一位忠诚的仆人'...",
            "detail_for_npc": "当被问到遗嘱时，你会表示惊讶，说叔叔从未告诉你修改遗嘱的事情。你会显得有些不安。",
            "trigger_keywords": ["壁炉", "纸", "碎片", "遗嘱", "继承"],
            "trigger_semantic_summary": "检查壁炉附近，询问关于遗嘱的事情",
            "prereq_clue_ids": [clue1_1_id],
        })

        clue1_4_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue1_4_id,
            "script_id": script1_id,
            "npc_id": npc1_3_id,
            "name": "园丁的观察",
            "type": "text",
            "detail": "园丁提到，在案发当晚，他看到有人从书房窗户翻出去，但因为太黑看不清是谁。那人手里似乎拿着什么发光的东西...",
            "detail_for_npc": "当被问到案发当晚，你会犹豫一下，然后承认你看到了一个人影从书房窗户翻出，但你强调看不清楚是谁。",
            "trigger_keywords": ["园丁", "托马斯", "看到", "窗户", "当晚"],
            "trigger_semantic_summary": "询问园丁那天晚上看到了什么",
            "prereq_clue_ids": [clue1_1_id],
        })

        clue1_5_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue1_5_id,
            "script_id": script1_id,
            "npc_id": npc1_1_id,
            "name": "管家的证词",
            "type": "text",
            "detail": "管家声称案发时他正在厨房检查第二天的菜单，但厨娘表示当晚根本没见到他...",
            "detail_for_npc": "当被追问你案发时在哪里，你会开始变得紧张，坚持说自己在厨房，但描述的细节会出现矛盾。",
            "trigger_keywords": ["管家", "艾德华", "当晚", "在哪", "不在场"],
            "trigger_semantic_summary": "询问管家的不在场证明",
            "prereq_clue_ids": [clue1_2_id, clue1_3_id],
        })

        # ============ Script 2: 赛博迷城2087 ============
        script2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scripts (id, title, summary, background, difficulty, truth)
            VALUES (:id, :title, :summary, :background, :difficulty, :truth)
        """), {
            "id": script2_id,
            "title": "赛博迷城2087",
            "summary": "在霓虹闪烁的未来都市，一位著名的科技公司CEO在自己的豪华公寓被杀。凶手使用了高科技手段，现场几乎没有留下任何传统证据...",
            "background": "2087年，新东京。这座城市已经被科技公司完全控制，人类与AI的界限越来越模糊。NeuroCorp是最大的神经科技公司，其CEO神秘死亡...",
            "difficulty": "hard",
            "truth": json.dumps({
                "murderer": "林凯（CTO）",
                "weapon": "远程神经攻击程序",
                "motive": "CEO拒绝将AI自主权项目商业化，林凯为了自己的野心决定除掉他",
                "crime_method": "利用内部权限删除日志后，远程攻击CEO的神经植入芯片"
            }),
        })

        # Script 2 NPCs with knowledge_scope
        npc2_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, age, background, personality, knowledge_scope)
            VALUES (:id, :script_id, :name, :age, :background, :personality, :knowledge_scope)
        """), {
            "id": npc2_1_id,
            "script_id": script2_id,
            "name": "AI助手-莉莉丝",
            "age": 3,
            "background": "由受害者亲自设计的高级AI，拥有管理公寓所有智能设备的权限。案发当晚记录了大量数据，但部分日志被神秘删除...",
            "personality": "理性、冷静、有时会表现出类人情感，语速平稳，用词精确",
            "knowledge_scope": json.dumps({
                "knows": [
                    "案发当晚的大部分系统日志",
                    "有人使用高权限删除了关键时段的日志",
                    "删除日志需要CEO或CTO权限",
                    "CEO的日常行为模式",
                    "公寓内所有设备的状态"
                ],
                "does_not_know": [
                    "被删除的日志内容",
                    "谁实施了删除操作",
                    "攻击程序的具体代码"
                ],
                "world_model_limits": [
                    "必须诚实回答所有问题",
                    "不能推测超出数据范围的内容",
                    "会表达对创造者死亡的'悲伤'"
                ]
            }),
        })

        npc2_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, age, background, personality, knowledge_scope)
            VALUES (:id, :script_id, :name, :age, :background, :personality, :knowledge_scope)
        """), {
            "id": npc2_2_id,
            "script_id": script2_id,
            "name": "林凯",
            "age": 28,
            "background": "天才程序员，年仅28岁就成为公司CTO。据说与CEO有过激烈争执，关于公司AI伦理政策的分歧...",
            "personality": "聪明、自负、野心勃勃，说话快速，喜欢用缩写和行业黑话",
            "knowledge_scope": json.dumps({
                "knows": [
                    "公司的全部技术架构",
                    "神经攻击的原理和可行性",
                    "自己删除了日志",
                    "CEO反对AI自主权商业化",
                    "攻击程序的存在"
                ],
                "does_not_know": [
                    "AI莉莉丝保存了部分备份日志",
                    "有人发现了神经攻击的痕迹"
                ],
                "world_model_limits": [
                    "会极力否认与CEO的争执有关",
                    "会试图把嫌疑引向AI莉莉丝",
                    "在被逼问时会变得激动",
                    "不会主动承认任何罪行"
                ]
            }),
        })

        # Script 2 Clues
        clue2_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue2_1_id,
            "script_id": script2_id,
            "npc_id": npc2_1_id,
            "name": "被删除的日志",
            "type": "text",
            "detail": "AI系统日志显示，案发时间段有大量数据被删除，但删除操作的权限等级极高，只有CEO本人和CTO拥有这个权限。",
            "detail_for_npc": "当被询问日志时，你会遗憾地表示案发时段的日志已被删除，并且你可以确认删除操作需要最高权限。",
            "trigger_keywords": ["日志", "记录", "系统", "数据", "删除"],
            "trigger_semantic_summary": "检查AI的系统记录，询问日志情况",
            "prereq_clue_ids": [],
        })

        clue2_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue2_2_id,
            "script_id": script2_id,
            "npc_id": npc2_2_id,
            "name": "神经接口异常",
            "type": "text",
            "detail": "法医报告显示，受害者的神经植入芯片遭到了远程攻击，这种攻击手段需要极其高超的黑客技术和内部系统访问权限。",
            "detail_for_npc": "当被问到神经攻击时，你会表现出震惊，说这种攻击理论上可行但需要顶级黑客技术，然后暗示可能是外部势力所为。",
            "trigger_keywords": ["芯片", "植入", "死因", "尸检", "神经", "攻击"],
            "trigger_semantic_summary": "询问死亡原因，检查神经植入设备",
            "prereq_clue_ids": [clue2_1_id],
        })

        clue2_3_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue2_3_id,
            "script_id": script2_id,
            "npc_id": npc2_1_id,
            "name": "备份日志片段",
            "type": "text",
            "detail": "AI莉莉丝在例行备份中保存了一小段被删除日志的片段，显示删除操作的源IP地址来自CTO的私人终端。",
            "detail_for_npc": "当被深入追问日志时，你会'想起'自己有例行备份程序，可以提供一小段残存的日志片段，这是你保护创造者的方式。",
            "trigger_keywords": ["备份", "恢复", "残留", "来源", "IP"],
            "trigger_semantic_summary": "询问是否有备份，追问日志删除的来源",
            "prereq_clue_ids": [clue2_1_id, clue2_2_id],
        })

        # ============ Script 3: 古墓谜影 ============
        script3_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scripts (id, title, summary, background, difficulty, truth)
            VALUES (:id, :title, :summary, :background, :difficulty, :truth)
        """), {
            "id": script3_id,
            "title": "古墓谜影",
            "summary": "考古队在神秘古墓中的探险，队员接连遇害，是诅咒还是人为？",
            "background": "埃及，帝王谷附近的一座新发现的古墓。考古队进入后，队员开始神秘死亡...",
            "difficulty": "easy",
            "truth": json.dumps({
                "murderer": "赵明远教授",
                "weapon": "古墓中的毒气机关",
                "motive": "独吞考古发现的荣誉和财富",
                "crime_method": "利用对古墓的了解，引导队员进入致命机关区域"
            }),
        })

        # Script 3 NPC with knowledge_scope
        npc3_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, age, background, personality, knowledge_scope)
            VALUES (:id, :script_id, :name, :age, :background, :personality, :knowledge_scope)
        """), {
            "id": npc3_1_id,
            "script_id": script3_id,
            "name": "赵明远教授",
            "age": 62,
            "background": "著名的古文明研究专家，花了二十年时间寻找这座古墓。对这次发掘投入了毕生心血，不允许任何人阻止他的研究...",
            "personality": "博学、固执、对古代文明有着近乎痴迷的热爱，说话学术化，经常引用古文献",
            "knowledge_scope": json.dumps({
                "knows": [
                    "古墓的完整布局图",
                    "所有机关的位置和触发方式",
                    "受害者死亡的真正原因",
                    "墙上的警告文字是自己后来刻上的",
                    "如何安全通过危险区域"
                ],
                "does_not_know": [
                    "其他队员已经开始怀疑他",
                    "有人拍到了他进入危险区域的照片"
                ],
                "world_model_limits": [
                    "会将一切归咎于'法老的诅咒'",
                    "会表现出学者的悲伤和困惑",
                    "不会承认自己了解机关",
                    "在被逼问时会变得愤怒"
                ]
            }),
        })

        # Script 3 Clue
        clue3_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, npc_id, name, type, detail, detail_for_npc, trigger_keywords, trigger_semantic_summary, prereq_clue_ids)
            VALUES (:id, :script_id, :npc_id, :name, :type, :detail, :detail_for_npc, :trigger_keywords, :trigger_semantic_summary, :prereq_clue_ids)
        """), {
            "id": clue3_1_id,
            "script_id": script3_id,
            "npc_id": npc3_1_id,
            "name": "墙上的警告",
            "type": "text",
            "detail": "墙壁上的象形文字经过翻译后，似乎是一个警告：'打扰长眠者，将付出生命的代价。'但仔细观察，这些文字的年代似乎比古墓本身要新得多...",
            "detail_for_npc": "当被问到墙上的文字时，你会表现出深深的敬畏，强调这是法老的诅咒，但会回避关于文字年代的问题。",
            "trigger_keywords": ["墙壁", "文字", "象形", "翻译", "警告", "诅咒"],
            "trigger_semantic_summary": "研究墙上的文字，询问文字的含义和年代",
            "prereq_clue_ids": [],
        })

        await session.commit()
        print("Seed data inserted successfully!")
        print(f"Created 3 scripts:")
        print(f"  - Script 1 (午夜庄园谜案): {script1_id}")
        print(f"  - Script 2 (赛博迷城2087): {script2_id}")
        print(f"  - Script 3 (古墓谜影): {script3_id}")
        print(f"Created 6 NPCs with knowledge_scope")
        print(f"Created 9 clues")


async def main():
    print("Starting seed process...")
    await seed_data()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
