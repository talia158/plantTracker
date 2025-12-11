# Web server & schema validation
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TestRequest(BaseModel):
    test_field: str


@app.get("/api/collection/{collectionID}")
def handle_expansion(collectionID: int):
    return {
        "works":"yes",
        "collection":str(collectionID)
        }


@app.post("/api/collection/test")
def run(request: TestRequest):
    return {"message": f"{request.test_field} works"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")