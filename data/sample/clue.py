import re
from dataclasses import dataclass, asdict
from typing import NewType

ClueId = NewType('ClueId', str)
NPCId = NewType('NPCId', str)
ScriptId = NewType('ScriptId', str)
Difficulty = NewType('Difficulty', str)

ClueType = NewType('ClueType', str)
TextClue:ClueType = 'text'
ImageClue:ClueType = 'image'

Easy:Difficulty = 'easy'
Medium:Difficulty = 'medium'
Hard:Difficulty = 'hard'


@dataclass
class Clue:
    id: ClueId
    npc_id: str
    name: str
    type: ClueType # text, image
    detail: str # 线索本身
    detail_for_npc: str # 指导 NPC 回答这条线索时需要说的话
    trigger_keywords: list[str] # for vector match
    trigger_semantic_summary: str # for vector match
    prereq_clues: list[ClueId] # 前置线索 这条线索需要前置线索才能解锁

@dataclass
class NPCKnowledgeScope:
    knows: list[str]
    does_not_know: list[str]
    world_model_limits: list[str]

@dataclass
class NPC:
    id: NPCId
    name: str 
    age: int
    background: str
    personality: str
    knowledge_scope: NPCKnowledgeScope

@dataclass
class Truth:
    murderer: NPCId
    weapon: str
    motive: str
    crime_method: str

@dataclass
class Script:
    id: ScriptId
    title: str
    summary: str
    background: str
    difficulty: Difficulty
    truth: Truth



@dataclass
class Progress:
    clue_ids: list[ClueId]

@dataclass
class LLMConfig:
    model: str
    base_url: str
    api_key: str

@dataclass
class EmbeddingConfig:
    model: str
    base_url: str
    api_key: str



def _resolve_jsonpath(obj, path: str):
    """
    解析类似 jsonpath 的路径，支持嵌套访问
    例如: 'name', 'trigger_keywords', 'nested.field'
    """
    parts = path.split('.')
    current = obj
    for part in parts:
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(part)
        elif hasattr(current, part):
            current = getattr(current, part)
        else:
            # 尝试将 dataclass 转换为 dict 再访问
            if hasattr(current, '__dataclass_fields__'):
                current = asdict(current).get(part)
            else:
                return None
    return current


def render_clue_template(template: str, clue: Clue) -> str:
    """
    将模板中的 {clue.xxx} 占位符替换为实际值

    支持的格式:
    - {clue.name} - 简单字段
    - {clue.trigger_keywords} - 列表字段 (会用逗号连接)
    - {clue.nested.field} - 嵌套字段 (jsonpath 风格)

    示例:
        template = '{clue.name}:{clue.detail}'
        render_clue_template(template, clue)
    """
    pattern = r'\{clue\.([^}]+)\}'

    def replace_match(match):
        path = match.group(1)
        value = _resolve_jsonpath(clue, path)
        if value is None:
            return match.group(0)  # 保留原始占位符
        if isinstance(value, list):
            return ', '.join(str(v) for v in value)
        return str(value)

    return re.sub(pattern, replace_match, template)


@dataclass
class ClueRetrievalStrategy:

    def retrieve_clues(self, message: str, clues: list[Clue]) -> Clue | None:
        pass

from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

class VectorClueRetrievalStrategy(ClueRetrievalStrategy):
    # vector search
    def __init__(self, embedding_config: EmbeddingConfig):
        self.embeddings = OpenAIEmbeddings(
            base_url=embedding_config.base_url,
            api_key=embedding_config.api_key,
            model=embedding_config.model)
        self.vector_store = Chroma(
            collection_name="example_collection",
            embedding_function=self.embeddings,
        )

    def build_embedding_db(self,
        prompt_template: str,
        clues: list[Clue],
    ):
        """
        构建嵌入数据库

        Args:
            prompt_template: 模板字符串，支持 {clue.xxx} 格式的占位符
                例如: '{clue.name}:{clue.detail}'
                嵌套字段使用 jsonpath 格式: '{clue.nested.field}'
            clues: 线索列表
        """
        for clue in clues:
            rendered_content = render_clue_template(prompt_template, clue)
            self.vector_store.add_documents(documents=[
                Document(
                    page_content=rendered_content,
                    metadata={
                        "clue_id": clue.id,
                        "npc_id": clue.npc_id,
                    },
                    id=clue.id,
                )])

    def retrieve_clues(self, message: str, clues: list[Clue]) -> Clue | None:
        results = self.vector_store.similarity_search(message, k=1)
        return results[0].metadata["clue_id"]

class LLMClueRetrievalStrategy(ClueRetrievalStrategy):
    # { match: true, clue_id: ClueId }
    # LLM search
    pass



@dataclass
class GameManager:
    script: Script
    progress: Progress
    clues: list[Clue]
    clue_retrieval_strategy: ClueRetrievalStrategy

    def get_known_clues(self) -> list[Clue]:
        return [clue for clue in self.clues if clue.id in self.progress.clue_ids]

    def get_npc_clues(self, npc_id: NPCId) -> list[Clue]:
        return [clue for clue in self.clues if clue.npc_id == npc_id]

    def filter_no_prereq_clues(self, npc_id: NPCId) -> list[Clue]:
        known_clues = self.get_known_clues()
        known_clue_ids = [clue.id for clue in known_clues]
        no_prereq_clues = []
        npc_clues = self.get_npc_clues(npc_id)
        for clue in npc_clues:
            if not clue.prereq_clues or \
                all(prereq_clue_id in known_clue_ids for prereq_clue_id in clue.prereq_clues):
                no_prereq_clues.append(clue)
        return no_prereq_clues
    
    def retrieve_and_select_clues(
        self,
        user_message: str,
        npc_id: NPCId,
    ) -> Clue | None:
        known_clues = self.get_known_clues()
        # pre rule engine
        no_prereq_clues = self.filter_no_prereq_clues(npc_id)
        retrieved_clue = self.clue_retrieval_strategy.retrieve_clues(user_message, no_prereq_clues)
        return retrieved_clue
    


from typing import Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

llm = ChatOpenAI(
    base_url="https://api.siliconflow.cn/v1",
    api_key=os.getenv("API_KEY"),
    model="deepseek-ai/DeepSeek-V3.1-Terminus")  


def npc_reply_with_clue(
    user_message: str,
    npc_config: NPC,
    selected_clue: Optional[Clue],
    conversation_history: dict[str, any]
) -> str:
    system_prompt = npc_config["llm_prompt"]["system_prompt"]
    system_msg = SystemMessage(content=system_prompt)

    history_msgs = []
    for h in conversation_history[-4:]:
        if h["role"] == "player":
            history_msgs.append(HumanMessage(content=h["content"]))
        else:
            history_msgs.append(AIMessage(content=h["content"]))


    if selected_clue:
        guide = (
            "【指引】请在接下来的回答中，自然地透露以下信息的一部分，"
            "用白梦雪的语气说出来，不要一次性讲完所有细节，"
            "不要提到'线索'、'卡牌'、'ID'等元信息：\n"
            f"{selected_clue['detail_for_npc']}\n"
        )
    else:
        guide = (
            "【指引】这一次你不需要提供新的关键情报，"
            "只需根据对白和人设，自然回应对方。"
        )

    user_msg = HumanMessage(
        content=f"{guide}\n玩家刚才的话是：{user_message}"
    )

    resp = llm.invoke([system_msg] + history_msgs + [user_msg])
    return resp.content
