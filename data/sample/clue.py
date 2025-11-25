from dataclasses import dataclass
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
class EmbeddingConfig:
    model: str
    base_url: str
    api_key: str

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
        prompt_template:str,
        clues: list[Clue],
    ):
        for clue in clues:
            self.vector_store.add_documents(documents=[
                Document(
                    page_content=prompt_template, 
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
    