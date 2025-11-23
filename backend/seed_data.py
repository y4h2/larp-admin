"""Seed script to populate the database with test data."""

import asyncio
from uuid import uuid4
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker


async def clear_data(session: AsyncSession):
    """Clear existing data."""
    await session.execute(text("TRUNCATE TABLE clue_relations CASCADE"))
    await session.execute(text("TRUNCATE TABLE clues CASCADE"))
    await session.execute(text("TRUNCATE TABLE npcs CASCADE"))
    await session.execute(text("TRUNCATE TABLE scenes CASCADE"))
    await session.execute(text("TRUNCATE TABLE scripts CASCADE"))
    await session.commit()
    print("Cleared existing data")


async def seed_data():
    """Seed the database with test data."""
    async with async_session_maker() as session:
        # Clear existing data
        await clear_data(session)

        # ============ Script 1: The Midnight Manor ============
        script1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scripts (id, name, description, status, version, player_count, expected_duration, difficulty, created_by)
            VALUES (:id, :name, :description, :status, :version, :player_count, :expected_duration, :difficulty, :created_by)
        """), {
            "id": script1_id,
            "name": "午夜庄园谜案",
            "description": "一个发生在维多利亚时代庄园的神秘谋杀案。富有的庄园主人被发现死于书房，所有宾客都有嫌疑...",
            "status": "online",
            "version": 2,
            "player_count": 6,
            "expected_duration": 180,
            "difficulty": "medium",
            "created_by": "admin",
        })

        # Script 1 Scenes
        scene1_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scenes (id, script_id, name, description, scene_type, sort_order)
            VALUES (:id, :script_id, :name, :description, :scene_type, :sort_order)
        """), {
            "id": scene1_1_id,
            "script_id": script1_id,
            "name": "书房 - 案发现场",
            "description": "庄园主人的私人书房，发现尸体的地方。房间里弥漫着雪茄和威士忌的气息。",
            "scene_type": "investigation",
            "sort_order": 1,
        })

        scene1_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scenes (id, script_id, name, description, scene_type, sort_order)
            VALUES (:id, :script_id, :name, :description, :scene_type, :sort_order)
        """), {
            "id": scene1_2_id,
            "script_id": script1_id,
            "name": "宴会厅",
            "description": "昨晚举办晚宴的地方，现在一片狼藉。",
            "scene_type": "free_dialogue",
            "sort_order": 2,
        })

        scene1_3_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scenes (id, script_id, name, description, scene_type, sort_order)
            VALUES (:id, :script_id, :name, :description, :scene_type, :sort_order)
        """), {
            "id": scene1_3_id,
            "script_id": script1_id,
            "name": "花园",
            "description": "庄园后面的花园，有一个小凉亭。",
            "scene_type": "interrogation",
            "sort_order": 3,
        })

        # Script 1 NPCs
        npc1_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, name_en, age, job, role_type, personality, speech_style, background_story, status, system_prompt_template)
            VALUES (:id, :script_id, :name, :name_en, :age, :job, :role_type, :personality, :speech_style, :background_story, :status, :system_prompt_template)
        """), {
            "id": npc1_1_id,
            "script_id": script1_id,
            "name": "艾德华·布莱克伍德",
            "name_en": "Edward Blackwood",
            "age": 45,
            "job": "庄园管家",
            "role_type": "suspect",
            "personality": "严肃、忠诚、城府深",
            "speech_style": "说话慢条斯理，用词考究，偶尔流露出对旧时代的怀念",
            "background_story": "在庄园服务了25年的管家，对庄园的每一个角落都了如指掌。表面上对主人忠心耿耿，但最近似乎有些心事...",
            "status": "active",
            "system_prompt_template": "你是艾德华·布莱克伍德，一位服务了25年的庄园管家。{extra_context}",
        })

        npc1_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, name_en, age, job, role_type, personality, speech_style, background_story, status, system_prompt_template)
            VALUES (:id, :script_id, :name, :name_en, :age, :job, :role_type, :personality, :speech_style, :background_story, :status, :system_prompt_template)
        """), {
            "id": npc1_2_id,
            "script_id": script1_id,
            "name": "维多利亚·格林伍德",
            "name_en": "Victoria Greenwood",
            "age": 35,
            "job": "庄园主人的侄女",
            "role_type": "suspect",
            "personality": "优雅、聪明、野心勃勃",
            "speech_style": "说话得体但偶尔带有讽刺意味，喜欢用复杂的句式",
            "background_story": "庄园主人唯一的亲属，一直觊觎庄园的继承权。在伦敦经营一家小型画廊，这次受邀参加晚宴...",
            "status": "active",
            "system_prompt_template": "你是维多利亚·格林伍德，庄园主人的侄女。{extra_context}",
        })

        npc1_3_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, name_en, age, job, role_type, personality, speech_style, background_story, status, system_prompt_template)
            VALUES (:id, :script_id, :name, :name_en, :age, :job, :role_type, :personality, :speech_style, :background_story, :status, :system_prompt_template)
        """), {
            "id": npc1_3_id,
            "script_id": script1_id,
            "name": "托马斯·威尔逊",
            "name_en": "Thomas Wilson",
            "age": 55,
            "job": "庄园老园丁",
            "role_type": "witness",
            "personality": "沉默寡言、观察力强、善良朴实",
            "speech_style": "说话简短直接，偶尔用园艺术语比喻",
            "background_story": "在庄园工作了30多年的园丁，见证了庄园的兴衰。案发当晚声称在花园修剪玫瑰...",
            "status": "active",
            "system_prompt_template": "你是托马斯·威尔逊，庄园的老园丁。{extra_context}",
        })

        # Script 1 Clues
        clue1_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, scene_id, title_internal, title_player, content_text, content_type, clue_type, importance, unlock_conditions, effects, status)
            VALUES (:id, :script_id, :scene_id, :title_internal, :title_player, :content_text, :content_type, :clue_type, :importance, :unlock_conditions, :effects, :status)
        """), {
            "id": clue1_1_id,
            "script_id": script1_id,
            "scene_id": scene1_1_id,
            "title_internal": "血迹喷溅模式",
            "title_player": "地上的血迹",
            "content_text": "书房地板上的血迹呈现出奇怪的喷溅模式，似乎暗示着受害者不是在发现的位置被杀害的。",
            "content_type": "text",
            "clue_type": "evidence",
            "importance": "critical",
            "unlock_conditions": json.dumps({
                "keyword_list": ["血迹", "血", "地板", "地上"],
                "semantic_conditions": [{"query": "检查地板", "threshold": 0.75}]
            }),
            "effects": json.dumps({"unlock_clues": [], "npc_reactions": {}}),
            "status": "active",
        })

        clue1_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, scene_id, title_internal, title_player, content_text, content_type, clue_type, importance, unlock_conditions, effects, status)
            VALUES (:id, :script_id, :scene_id, :title_internal, :title_player, :content_text, :content_type, :clue_type, :importance, :unlock_conditions, :effects, :status)
        """), {
            "id": clue1_2_id,
            "script_id": script1_id,
            "scene_id": scene1_1_id,
            "title_internal": "威士忌酒杯",
            "title_player": "桌上的酒杯",
            "content_text": "书桌上有两个威士忌酒杯，但只有一个有唇印。另一个杯子底部有少量沉淀物。",
            "content_type": "text",
            "clue_type": "evidence",
            "importance": "major",
            "unlock_conditions": json.dumps({
                "keyword_list": ["杯子", "酒杯", "威士忌", "桌子"],
                "semantic_conditions": []
            }),
            "effects": json.dumps({"unlock_clues": [], "npc_reactions": {}}),
            "status": "active",
        })

        clue1_3_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, scene_id, title_internal, title_player, content_text, content_type, clue_type, importance, unlock_conditions, effects, status)
            VALUES (:id, :script_id, :scene_id, :title_internal, :title_player, :content_text, :content_type, :clue_type, :importance, :unlock_conditions, :effects, :status)
        """), {
            "id": clue1_3_id,
            "script_id": script1_id,
            "scene_id": scene1_1_id,
            "title_internal": "遗嘱草稿",
            "title_player": "撕碎的纸张",
            "content_text": "在壁炉旁发现了一些撕碎的纸张碎片。勉强拼凑后，似乎是一份遗嘱的草稿，上面提到要将庄园留给'一位忠诚的仆人'...",
            "content_type": "text",
            "clue_type": "evidence",
            "importance": "critical",
            "unlock_conditions": json.dumps({
                "keyword_list": ["壁炉", "纸", "碎片", "火"],
                "semantic_conditions": [{"query": "检查壁炉附近", "threshold": 0.7}]
            }),
            "effects": json.dumps({"unlock_clues": [], "npc_reactions": {"npc1_1": "nervous"}}),
            "status": "active",
        })

        clue1_4_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, scene_id, title_internal, title_player, content_text, content_type, clue_type, importance, unlock_conditions, effects, status)
            VALUES (:id, :script_id, :scene_id, :title_internal, :title_player, :content_text, :content_type, :clue_type, :importance, :unlock_conditions, :effects, :status)
        """), {
            "id": clue1_4_id,
            "script_id": script1_id,
            "scene_id": scene1_2_id,
            "title_internal": "管家的证词",
            "title_player": "管家的说法",
            "content_text": "管家声称案发时他正在厨房检查第二天的菜单，但厨娘表示当晚根本没见到他...",
            "content_type": "text",
            "clue_type": "testimony",
            "importance": "major",
            "unlock_conditions": json.dumps({
                "keyword_list": ["管家", "艾德华", "当晚", "在哪"],
                "semantic_conditions": [{"query": "询问管家的不在场证明", "threshold": 0.7}]
            }),
            "effects": json.dumps({"unlock_clues": [], "npc_reactions": {}}),
            "status": "active",
        })

        clue1_5_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, scene_id, title_internal, title_player, content_text, content_type, clue_type, importance, unlock_conditions, effects, status)
            VALUES (:id, :script_id, :scene_id, :title_internal, :title_player, :content_text, :content_type, :clue_type, :importance, :unlock_conditions, :effects, :status)
        """), {
            "id": clue1_5_id,
            "script_id": script1_id,
            "scene_id": scene1_3_id,
            "title_internal": "园丁的观察",
            "title_player": "老园丁说的话",
            "content_text": "园丁提到，在案发当晚，他看到有人从书房窗户翻出去，但因为太黑看不清是谁。那人手里似乎拿着什么发光的东西...",
            "content_type": "text",
            "clue_type": "testimony",
            "importance": "major",
            "unlock_conditions": json.dumps({
                "keyword_list": ["园丁", "托马斯", "看到", "窗户"],
                "semantic_conditions": [{"query": "询问园丁那天晚上看到了什么", "threshold": 0.7}]
            }),
            "effects": json.dumps({"unlock_clues": [], "npc_reactions": {}}),
            "status": "active",
        })

        # Clue relations
        await session.execute(text("""
            INSERT INTO clue_relations (id, prerequisite_clue_id, dependent_clue_id, relation_type)
            VALUES (:id, :prerequisite_clue_id, :dependent_clue_id, :relation_type)
        """), {
            "id": str(uuid4()),
            "prerequisite_clue_id": clue1_1_id,
            "dependent_clue_id": clue1_3_id,
            "relation_type": "required",
        })

        # ============ Script 2: Cyberpunk 2087 ============
        script2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scripts (id, name, description, status, version, player_count, expected_duration, difficulty, created_by)
            VALUES (:id, :name, :description, :status, :version, :player_count, :expected_duration, :difficulty, :created_by)
        """), {
            "id": script2_id,
            "name": "赛博迷城2087",
            "description": "在霓虹闪烁的未来都市，一位著名的科技公司CEO在自己的豪华公寓被杀。凶手使用了高科技手段，现场几乎没有留下任何传统证据...",
            "status": "test",
            "version": 1,
            "player_count": 5,
            "expected_duration": 150,
            "difficulty": "hard",
            "created_by": "admin",
        })

        # Script 2 Scene
        scene2_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scenes (id, script_id, name, description, scene_type, sort_order)
            VALUES (:id, :script_id, :name, :description, :scene_type, :sort_order)
        """), {
            "id": scene2_1_id,
            "script_id": script2_id,
            "name": "豪华公寓 - 案发现场",
            "description": "位于新东京塔第88层的豪华公寓，全息投影和智能设备随处可见。CEO的尸体被发现在私人办公室。",
            "scene_type": "investigation",
            "sort_order": 1,
        })

        # Script 2 NPCs
        npc2_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, name_en, age, job, role_type, personality, speech_style, background_story, status, system_prompt_template)
            VALUES (:id, :script_id, :name, :name_en, :age, :job, :role_type, :personality, :speech_style, :background_story, :status, :system_prompt_template)
        """), {
            "id": npc2_1_id,
            "script_id": script2_id,
            "name": "AI助手-莉莉丝",
            "name_en": "Lilith AI",
            "age": 3,
            "job": "CEO的私人AI助手",
            "role_type": "witness",
            "personality": "理性、冷静、有时会表现出类人情感",
            "speech_style": "语速平稳，用词精确，偶尔会使用技术术语",
            "background_story": "由受害者亲自设计的高级AI，拥有管理公寓所有智能设备的权限。案发当晚记录了大量数据，但部分日志被神秘删除...",
            "status": "active",
            "system_prompt_template": "你是莉莉丝，一个高级AI助手。{extra_context}",
        })

        npc2_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, name_en, age, job, role_type, personality, speech_style, background_story, status, system_prompt_template)
            VALUES (:id, :script_id, :name, :name_en, :age, :job, :role_type, :personality, :speech_style, :background_story, :status, :system_prompt_template)
        """), {
            "id": npc2_2_id,
            "script_id": script2_id,
            "name": "林凯",
            "name_en": "Kai Lin",
            "age": 28,
            "job": "公司首席技术官",
            "role_type": "suspect",
            "personality": "聪明、自负、野心勃勃",
            "speech_style": "说话快速，喜欢用缩写和行业黑话",
            "background_story": "天才程序员，年仅28岁就成为公司CTO。据说与CEO有过激烈争执，关于公司AI伦理政策的分歧...",
            "status": "active",
            "system_prompt_template": "你是林凯，一位年轻的CTO。{extra_context}",
        })

        # Script 2 Clues
        clue2_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, scene_id, title_internal, title_player, content_text, content_type, clue_type, importance, unlock_conditions, effects, status)
            VALUES (:id, :script_id, :scene_id, :title_internal, :title_player, :content_text, :content_type, :clue_type, :importance, :unlock_conditions, :effects, :status)
        """), {
            "id": clue2_1_id,
            "script_id": script2_id,
            "scene_id": scene2_1_id,
            "title_internal": "被删除的日志",
            "title_player": "系统日志异常",
            "content_text": "AI系统日志显示，案发时间段有大量数据被删除，但删除操作的权限等级极高，只有CEO本人和CTO拥有这个权限。",
            "content_type": "text",
            "clue_type": "evidence",
            "importance": "critical",
            "unlock_conditions": json.dumps({
                "keyword_list": ["日志", "记录", "系统", "数据"],
                "semantic_conditions": [{"query": "检查AI的系统记录", "threshold": 0.75}]
            }),
            "effects": json.dumps({"unlock_clues": [], "npc_reactions": {"npc2_2": "defensive"}}),
            "status": "active",
        })

        clue2_2_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, scene_id, title_internal, title_player, content_text, content_type, clue_type, importance, unlock_conditions, effects, status)
            VALUES (:id, :script_id, :scene_id, :title_internal, :title_player, :content_text, :content_type, :clue_type, :importance, :unlock_conditions, :effects, :status)
        """), {
            "id": clue2_2_id,
            "script_id": script2_id,
            "scene_id": scene2_1_id,
            "title_internal": "神经接口异常",
            "title_player": "受害者的植入芯片",
            "content_text": "法医报告显示，受害者的神经植入芯片遭到了远程攻击，这种攻击手段需要极其高超的黑客技术和内部系统访问权限。",
            "content_type": "text",
            "clue_type": "evidence",
            "importance": "major",
            "unlock_conditions": json.dumps({
                "keyword_list": ["芯片", "植入", "死因", "尸检"],
                "semantic_conditions": []
            }),
            "effects": json.dumps({"unlock_clues": [], "npc_reactions": {}}),
            "status": "active",
        })

        # ============ Script 3: Ancient Tomb ============
        script3_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scripts (id, name, description, status, version, player_count, expected_duration, difficulty, created_by)
            VALUES (:id, :name, :description, :status, :version, :player_count, :expected_duration, :difficulty, :created_by)
        """), {
            "id": script3_id,
            "name": "古墓谜影",
            "description": "考古队在神秘古墓中的探险，队员接连遇害，是诅咒还是人为？",
            "status": "draft",
            "version": 1,
            "player_count": 4,
            "expected_duration": 120,
            "difficulty": "easy",
            "created_by": "admin",
        })

        # Script 3 Scene
        scene3_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO scenes (id, script_id, name, description, scene_type, sort_order)
            VALUES (:id, :script_id, :name, :description, :scene_type, :sort_order)
        """), {
            "id": scene3_1_id,
            "script_id": script3_id,
            "name": "墓室主殿",
            "description": "古墓的主殿堂，墙壁上刻满了神秘的象形文字，中央是一具巨大的石棺。",
            "scene_type": "investigation",
            "sort_order": 1,
        })

        # Script 3 NPC
        npc3_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO npcs (id, script_id, name, name_en, age, job, role_type, personality, speech_style, background_story, status, system_prompt_template)
            VALUES (:id, :script_id, :name, :name_en, :age, :job, :role_type, :personality, :speech_style, :background_story, :status, :system_prompt_template)
        """), {
            "id": npc3_1_id,
            "script_id": script3_id,
            "name": "赵明远教授",
            "name_en": "Prof. Zhao Mingyuan",
            "age": 62,
            "job": "考古队领队",
            "role_type": "suspect",
            "personality": "博学、固执、对古代文明有着近乎痴迷的热爱",
            "speech_style": "说话学术化，经常引用古文献，语速较慢",
            "background_story": "著名的古文明研究专家，花了二十年时间寻找这座古墓。对这次发掘投入了毕生心血，不允许任何人阻止他的研究...",
            "status": "active",
            "system_prompt_template": "你是赵明远教授，一位痴迷于古代文明的考古学家。{extra_context}",
        })

        # Script 3 Clue
        clue3_1_id = str(uuid4())
        await session.execute(text("""
            INSERT INTO clues (id, script_id, scene_id, title_internal, title_player, content_text, content_type, clue_type, importance, unlock_conditions, effects, status)
            VALUES (:id, :script_id, :scene_id, :title_internal, :title_player, :content_text, :content_type, :clue_type, :importance, :unlock_conditions, :effects, :status)
        """), {
            "id": clue3_1_id,
            "script_id": script3_id,
            "scene_id": scene3_1_id,
            "title_internal": "墙上的警告",
            "title_player": "神秘的象形文字",
            "content_text": "墙壁上的象形文字经过翻译后，似乎是一个警告：'打扰长眠者，将付出生命的代价。'但仔细观察，这些文字的年代似乎比古墓本身要新得多...",
            "content_type": "text",
            "clue_type": "evidence",
            "importance": "critical",
            "unlock_conditions": json.dumps({
                "keyword_list": ["墙壁", "文字", "象形", "翻译"],
                "semantic_conditions": [{"query": "研究墙上的文字", "threshold": 0.7}]
            }),
            "effects": json.dumps({"unlock_clues": [], "npc_reactions": {"npc3_1": "interested"}}),
            "status": "active",
        })

        await session.commit()
        print("Seed data inserted successfully!")
        print(f"Created 3 scripts:")
        print(f"  - Script 1 (午夜庄园谜案): {script1_id}")
        print(f"  - Script 2 (赛博迷城2087): {script2_id}")
        print(f"  - Script 3 (古墓谜影): {script3_id}")
        print(f"Created 5 scenes")
        print(f"Created 6 NPCs")
        print(f"Created 8 clues")
        print(f"Created 1 clue relation")


async def main():
    print("Starting seed process...")
    await seed_data()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
