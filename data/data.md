

Clue

```yaml


```





```
CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    case_id INTEGER REFERENCES cases(id),
    name VARCHAR(255) NOT NULL,               -- 角色姓名
    age INTEGER,                              -- 年龄
    occupation VARCHAR(255),                  -- 职业
    personality TEXT,                         -- 性格
    background JSONB NOT NULL,                -- 背景故事
    case_info JSONB NOT NULL,                 -- 案件相关信息
    dialogue_style JSONB NOT NULL,            -- 对话风格
    knowledge_graph JSONB NOT NULL,           -- 知识图谱
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```


```
CREATE TABLE script (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,              -- 案件标题
    summary TEXT NOT NULL,                -- 案件描述
    difficulty VARCHAR(20),                   -- 难度：简单/中等/困难
    background TEXT NOT NULL,                 -- 案件背景
    truth JSONB NOT NULL,                     -- 真相信息
    timeline JSONB NOT NULL,                  -- 时间线
    evidence_chains JSONB NOT NULL,           -- 证据链
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

```