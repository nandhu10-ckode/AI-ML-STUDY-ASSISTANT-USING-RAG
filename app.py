
from dotenv import load_dotenv
import os
import streamlit as st

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq

# Load environment variables from .env
load_dotenv()

# 1. Page configuration
st.set_page_config(
    page_title="AI/ML Study Assistant",
    page_icon="🤖"
)

st.title("🤖 AI/ML Study Assistant")
st.write("Ask questions from your AI/ML PDF notes.")

# 2. Check API key
if not os.getenv("GROQ_API_KEY"):
    st.error("GROQ_API_KEY is missing. Please check your .env file.")
    st.stop()

# 3. Create embeddings
@st.cache_resource
def load_embeddings():
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

embeddings = load_embeddings()

# 4. Load Chroma vector database
if not os.path.isdir("vectorstore"):
    st.error(
        "Vectorstore folder not found. "
        "Please create the vector database first."
    )
    st.stop()

vectorstore = Chroma(
    persist_directory="vectorstore",
    embedding_function=embeddings
)

# 5. Create retriever
retriever = vectorstore.as_retriever(
    search_kwargs={"k": 4}
)

# 6. Create Groq language model
llm = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0
)

# 7. Get user question
question = st.text_input("Ask your question:")

# 8. RAG process
if question.strip():

    with st.spinner("Searching your notes and generating an answer..."):
        # Retrieve relevant documents
        documents = retriever.invoke(question)

        if not documents:
            st.warning(
                "No relevant documents found in your uploaded notes."
            )
            st.stop()

        # Combine retrieved text
        context = "\n\n".join(
            document.page_content
            for document in documents
        )

        # Create prompt
        prompt = f"""
You are an AI/ML study assistant.

Answer using only the information provided
in the context below.

If the answer is not present in the context,
say exactly:
"I could not find this information in the uploaded notes."

Context:
{context}

Question:
{question}

Answer:
"""

        # Generate answer
        response = llm.invoke(prompt)

    # 9. Display answer
    st.subheader("Answer")
    st.write(response.content)

    # 10. Display sources
    st.subheader("Sources")

    seen_sources = set()

    for document in documents:
        source = document.metadata.get("source", "Unknown")
        page = document.metadata.get("page", "Unknown")

        source_info = (source, page)

        if source_info not in seen_sources:
            st.write(f"📄 {source} | Page: {page}")
            seen_sources.add(source_info)
