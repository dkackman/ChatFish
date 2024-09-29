from fastapi import FastAPI
from chat import load_qwen, chat_with_qwen

app = FastAPI()

model, tokenizer = load_qwen()


@app.get("/")
async def root():
    return {"message": "Hello, World!"}


@app.get("/items/{item_id}")
async def read_item(item_id: str):
    return {"response": chat_with_qwen(model, tokenizer, item_id)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
