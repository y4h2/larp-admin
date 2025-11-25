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




class ClueRetrievalStrategy:
    
    def retrieve_clues(self, message: str, clues: list[Clue]) -> Clue | None:
        pass


class VectorClueRetrievalStrategy(ClueRetrievalStrategy):
    # vector search
    pass

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
    