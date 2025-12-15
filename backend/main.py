"""
Backend API for plantTracker
TODO Extension for the scenario where one collection has more than one species
"""

import uvicorn
from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel

import shutil

import sqlite3
import pandas as pd
import os
import re
from typing import Any, Dict, Optional

# Paths: source CSV locations and SQLite DB path
SPECIES_CSV = 'data/cultivationinfo.csv'
COLLECTION_CSV = 'data/seedcollection.csv'
db_path = "data/database.db"

# App and Middleware setup (CORS limited to local frontend)
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CSV parsing and cleaning
# Normalize column names, types, whitespace, and add parsed lat/lon
def load_and_clean_collection_csv(path: str) -> pd.DataFrame:
    """Load the collection CSV, clean it, and add parsed Latitude/Longitude columns."""
    # Read raw CSV with thousands handling and NA defaults
    df = pd.read_csv(
        path,
        thousands=",",
        keep_default_na=True
    )

    # Standardize column names in a known order
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

    # Keep only the columns we persist
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

    # Coerce numeric fields to floats/ints where applicable
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

    # Normalize dates to ISO yyyy-mm-dd
    df["Date Collected"] = pd.to_datetime(df["Date Collected"], errors="coerce").dt.strftime("%Y-%m-%d")

    # Trim whitespace in string/object columns
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].str.strip()

    # Parse Cords into decimal lat/lon
    coords = df["Cords"].apply(parse_coords)
    df["Latitude"] = coords.apply(lambda c: c["lat"] if c else None)
    df["Longitude"] = coords.apply(lambda c: c["lng"] if c else None)

    # Reorder with lat/lon included for DB insert
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
            "Latitude",
            "Longitude",
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

    return df


# Coordinate helpers
def dms_to_decimal(dms: str, fallback_hemi: str) -> Optional[float]:
    """Convert a DMS string to signed decimal degrees, defaulting hemisphere when missing."""
    # Regex captures deg / min / sec and optional hemisphere; tolerant of common quote symbols
    m = re.match(r"(\d+)[°\s]+(\d+)[’'\s]+([\d.]+)[\"”]?\s*([NSEW])?", dms.strip(), re.IGNORECASE)
    if not m:
        return None

    try:
        deg = float(m.group(1))
        minutes = float(m.group(2))
        seconds = float(m.group(3))
    except (TypeError, ValueError):
        return None

    dec = deg + minutes / 60 + seconds / 3600
    hemi = (m.group(4) or fallback_hemi).upper()
    if hemi in ("S", "W"):
        dec *= -1
    return dec


def parse_coords(raw: Any) -> Optional[Dict[str, float]]:
    """Parse a free-form coordinate string into a lat/lng dict if valid."""
    if not isinstance(raw, str):
        return None

    s = raw.strip()
    parts = s.split()
    if len(parts) < 2:
        return None

    lat_part = parts[0]
    lng_part = " ".join(parts[1:])

    # Convert each side to decimal degrees
    lat = dms_to_decimal(lat_part, "N")
    lng = dms_to_decimal(lng_part, "W")

    if lat is None or lng is None:
        return None

    # Enforce valid ranges
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None

    return {"lat": lat, "lng": lng}


# Database bootstrap
def initialize_sqlite_db():
    """Create SQLite schema and reload data from CSVs."""
    os.makedirs("data", exist_ok=True)

    con = None
    try:
        con = sqlite3.connect("data/database.db")
        cur = con.cursor()
        cur.execute("PRAGMA foreign_keys = ON;")

        # Create tables and index
        with open('data/create_species_data.txt', 'r') as file:
            create_species_data = file.read()
        cur.execute(create_species_data)

        with open('data/create_collection_data.txt', 'r') as file:
            create_collection_data = file.read()
        cur.execute(create_collection_data)
        with open('data/create_collection_index.txt', 'r') as file:
            create_collection_index = file.read()
        cur.execute(create_collection_index)

        # Load CSVs and seed tables
        try:
            species_df = pd.read_csv(SPECIES_CSV)
            collection_df = load_and_clean_collection_csv(COLLECTION_CSV)

            species_df.to_sql("SpeciesData", con, if_exists='append', index=False)
            con.commit()

            collection_df.to_sql("CollectionData", con, if_exists='append', index=False)
            con.commit()

        except Exception as e:
            print(f"Error initializing SQLite DB: {e}")
    except sqlite3.Error as e:
        print(f"SQLite error during initialization: {e}")
    finally:
        if con:
            con.close()


# Query helpers
def get_collection_with_species(collection_code: str):
    """Fetch one collection row joined to species data, or None if missing."""
    con = None
    try:
        con = sqlite3.connect("data/database.db")
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        # Read query from file and execute with parameter binding
        with open('data/query_database.txt', 'r') as file:
            query = file.read()

        cur.execute(query, (collection_code,))
        row = cur.fetchone()

        if row is None:
            return None

        return dict(row)
    except sqlite3.Error as e:
        print(f"SQLite error fetching collection: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        if con:
            con.close()


@app.get("/api/collection/{collectionID}")
# Fetch a single collection with species join
def get_collection_info(collectionID: str):
    """Return a collection with species fields plus parsed latitude/longitude."""
    res = get_collection_with_species(collectionID)
    if res is None:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Backfill lat/lng if missing in DB
    lat = res.get("Latitude")
    lng = res.get("Longitude")

    if lat is None or lng is None:
        coords = parse_coords(res.get("Cords"))
        res["Latitude"] = coords["lat"] if coords else None
        res["Longitude"] = coords["lng"] if coords else None

    return res


# API endpoints
@app.get("/api/collections")
# List collections within a bounding box with pagination
def list_collections(
    minLat: float,
    maxLat: float,
    minLng: float,
    maxLng: float,
    limit: int = 200,
    offset: int = 0,
):
    """Return paginated collections within a lat/lng bounding box."""
    # Validate bounds and normalize pagination
    if not (-90 <= minLat <= 90 and -90 <= maxLat <= 90):
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
    if not (-180 <= minLng <= 180 and -180 <= maxLng <= 180):
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")
    if minLat > maxLat or minLng > maxLng:
        raise HTTPException(status_code=400, detail="Min bounds must be less than or equal to max bounds")

    limit = max(1, min(limit, 1000))
    offset = max(0, offset)

    con = None
    try:
        con = sqlite3.connect("data/database.db")
        con.row_factory = sqlite3.Row
        cur = con.cursor()

        # Count total items in bounds
        params = (minLat, maxLat, minLng, maxLng)
        with open("data/query_collections_count.txt", "r") as file:
            count_query = file.read()
        cur.execute(count_query, params)
        total = cur.fetchone()["total"]

        # Fetch paginated subset
        with open("data/query_collections_list.txt", "r") as file:
            list_query = file.read()
        cur.execute(list_query, params + (limit, offset))

        items = [dict(row) for row in cur.fetchall()]
    except sqlite3.Error as e:
        print(f"SQLite error listing collections: {e}")
        raise HTTPException(status_code=500, detail="Database error")
    finally:
        if con:
            con.close()

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.post("/api/upload")
# Upload fresh CSVs and rebuild the database
async def upload_csvs(
    species_csv: UploadFile = File(...),
    collection_csv: UploadFile = File(...),
):
    """Accept new CSV uploads, replace existing files, and rebuild SQLite."""
    os.makedirs("data", exist_ok=True)

    if not species_csv.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="species_csv must be a .csv file")
    if not collection_csv.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="collection_csv must be a .csv file")

    tmp_species = SPECIES_CSV + ".tmp"
    tmp_collection = COLLECTION_CSV + ".tmp"

    try:
        # Write uploads to temp files
        with open(tmp_species, "wb") as f:
            shutil.copyfileobj(species_csv.file, f)
        with open(tmp_collection, "wb") as f:
            shutil.copyfileobj(collection_csv.file, f)

        # Atomically replace originals
        os.replace(tmp_species, SPECIES_CSV)
        os.replace(tmp_collection, COLLECTION_CSV)
    finally:
        species_csv.file.close()
        collection_csv.file.close()

    # Rebuild the database from new inputs
    if os.path.exists(db_path):
        os.remove(db_path)
    initialize_sqlite_db()

    return {
        "message": "Files saved",
        "species_path": SPECIES_CSV,
        "collection_path": COLLECTION_CSV,
    }


if not os.path.exists(db_path):
    initialize_sqlite_db()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")
