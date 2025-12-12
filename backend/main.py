"""
Backend API for plantTracker
TODO Containerization with Docker
TODO Extension for the scenario where one collection has more than one species
"""

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sqlite3
import pandas as pd
import os

SPECIES_CSV = 'data/cultivationinfo.csv'
COLLECTION_CSV = 'data/seedcollection.csv'

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


def load_and_clean_collection_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(
        path,
        thousands=",",
        keep_default_na=True
    )

    df.columns = [
        "Collection Code",
        "Species Code",
        "Scientific Name",
        "Common Name",
        "Per Ounce",
        "Weight",
        "Seed Count",
        "Chaff",
        "PLS",
        "Date Collected",
        "Cords",
        "Year Collected",
        "County",
        "Formation",
        "Elevation",
        "Ran Out",
        "Prairie Moon",
        "Storage Code",
        "Notes",
    ]

    df = df[
        [
            "Collection Code",
            "Species Code",
            "Common Name",
            "Per Ounce",
            "Weight",
            "Chaff",
            "PLS",
            "Date Collected",
            "Cords",
            "Year Collected",
            "County",
            "Formation",
            "Elevation",
            "Ran Out",
            "Prairie Moon",
            "Storage Code",
            "Notes",
        ]
    ]

    numeric_cols = [
        "Per Ounce",
        "Weight",
        "Chaff",
        "PLS",
        "Year Collected",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df["Date Collected"] = pd.to_datetime(df["Date Collected"], errors="coerce").dt.strftime("%Y-%m-%d")

    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].str.strip()

    return df


def initialize_sqlite_db():
    os.makedirs("data", exist_ok=True)

    con = sqlite3.connect("data/database.db")
    cur = con.cursor()
    cur.execute("PRAGMA foreign_keys = ON;")

    with open('data/create_species_data.txt', 'r') as file:
        create_species_data = file.read()
    cur.execute(create_species_data)

    with open('data/create_collection_data.txt', 'r') as file:
        create_collection_data = file.read()
    cur.execute(create_collection_data)

    try:
        species_df = pd.read_csv(SPECIES_CSV)
        collection_df = load_and_clean_collection_csv(COLLECTION_CSV)

        species_df.to_sql("SpeciesData", con, if_exists='append', index=False)
        con.commit()

        collection_df.to_sql("CollectionData", con, if_exists='append', index=False)
        con.commit()

    except Exception as e:
        print(f"Error initializing SQLite DB: {e}")

    con.close()


def get_collection_with_species(collection_code: str):
    con = sqlite3.connect("data/database.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    with open('data/query_database.txt', 'r') as file:
        query = file.read()

    cur.execute(query, (collection_code,))
    row = cur.fetchone()

    con.close()

    if row is None:
        return None

    return dict(row)


@app.get("/api/collection/{collectionID}")
def get_collection_info(collectionID: str):
    res = get_collection_with_species(collectionID)
    if res is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    return res


@app.post("/api/collection/test")
def run(request: TestRequest):
    return {"message": f"{request.test_field} works"}

if not os.path.exists("data/database.db"):
    initialize_sqlite_db()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")
