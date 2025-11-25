

# 评价系统
对于大模型的回复，可以从多个维度进行打分


# 对话模拟页面


存储历史对话。历史对话发送给大模型。
NPC 对话模板应该分成三种提示词，system prompt, user prompt, AI prompt


把线索调试页面和合并入对话模拟页面。然后添加一个flag，如果不勾选这个flag则指运行线索匹配策略，并且,NPC对话相关的选项灰色不可选，勾选这个flag则先运行线索匹配策略再运行NPC对话


# 线索树
- 允许用户删除线索间的依赖



# 匹配策略
embedding 的匹配策略，参考VectorClueRetrievalStrategy的实现