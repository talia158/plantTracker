import { useMemo, useRef, useState } from "react"
import axios from "axios"
import {
  TextField,
  Button,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  Paper,
  Box,
} from "@mui/material"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet"
import type { LatLngExpression } from "leaflet"
import "leaflet/dist/leaflet.css"

function dmsToDecimal(dms: string, fallbackHemi: "N" | "S" | "E" | "W") {
  const m = dms.match(/(\d+)[°\s]+(\d+)[’'\s]+([\d.]+)["”]?\s*([NSEW])?/i)
  if (!m) return null
  const deg = Number(m[1])
  const min = Number(m[2])
  const sec = Number(m[3])
  if ([deg, min, sec].some((n) => Number.isNaN(n))) return null
  let dec = deg + min / 60 + sec / 3600
  const hemi = ((m[4] as string | undefined) || fallbackHemi).toUpperCase()
  if (hemi === "S" || hemi === "W") dec *= -1
  return dec
}

function parseCoords(raw: unknown): { lat: number; lng: number } | null {
  if (typeof raw !== "string") return null
  const s = raw.trim()

  const parts = s.split(/\s+/)
  if (parts.length < 2) return null

  const latPart = parts[0]
  const lngPart = parts.slice(1).join(" ")

  const lat = dmsToDecimal(latPart, "N")
  const lng = dmsToDecimal(lngPart, "W")

  if (lat === null || lng === null) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

  return { lat, lng }
}

function App() {
  const [collectionID, setCollectionID] = useState("")
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [speciesFile, setSpeciesFile] = useState<File | null>(null)
  const [collectionFile, setCollectionFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const speciesInputRef = useRef<HTMLInputElement | null>(null)
  const collectionInputRef = useRef<HTMLInputElement | null>(null)

  const selectedDate = useMemo(() => {
    const raw = data?.["Date Collected"]
    if (typeof raw !== "string") return null
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  }, [data])

  const coords = useMemo(() => parseCoords(data?.["Cords"]), [data])

  const mapCenter = useMemo<LatLngExpression | null>(() => {
    if (!coords) return null
    return [coords.lat, coords.lng] as LatLngExpression
  }, [coords])

  const handleFetch = async () => {
    const id = collectionID.trim()
    if (!id) return

    setError(null)
    setData(null)

    try {
      const res = await axios.get(`http://localhost:8000/api/collection/${id}`)
      setData(res.data)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || `request failed with status ${err.response?.status}`)
      } else {
        setError("unknown error")
      }
    }
  }

  const pickSpeciesCsv = () => {
    setError(null)
    setUploadStatus(null)
    if (speciesInputRef.current) speciesInputRef.current.value = ""
    speciesInputRef.current?.click()
  }

  const pickCollectionCsv = () => {
    setError(null)
    setUploadStatus(null)
    if (collectionInputRef.current) collectionInputRef.current.value = ""
    collectionInputRef.current?.click()
  }

  const onSpeciesPicked = (file: File | null) => {
    if (!file) return
    setSpeciesFile(file)
  }

  const onCollectionPicked = (file: File | null) => {
    if (!file) return
    setCollectionFile(file)
  }

  const uploadBoth = async () => {
    if (!speciesFile || !collectionFile) return

    setUploading(true)
    setUploadStatus("Uploading...")
    setError(null)

    try {
      const form = new FormData()
      form.append("species_csv", speciesFile)
      form.append("collection_csv", collectionFile)

      await axios.post("http://localhost:8000/api/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      setUploadStatus("Upload complete.")
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || `upload failed with status ${err.response?.status}`)
      } else {
        setError("unknown upload error")
      }
      setUploadStatus(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 1200, mx: "auto", mt: 6, px: 2 }}>
      <Typography variant="h5">PlantTracker</Typography>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Button variant="outlined" onClick={pickSpeciesCsv} disabled={uploading}>
          Upload Species CSV
        </Button>

        <Button variant="outlined" onClick={pickCollectionCsv} disabled={uploading}>
          Upload Collection CSV
        </Button>

        <Button
          variant="contained"
          onClick={uploadBoth}
          disabled={uploading || !speciesFile || !collectionFile}
        >
          Update Database
        </Button>

        <Typography variant="body2" sx={{ color: "gray" }}>
          Species: {speciesFile ? speciesFile.name : "—"} | Collection:{" "}
          {collectionFile ? collectionFile.name : "—"}
        </Typography>

        {uploadStatus && (
          <Typography variant="body2" sx={{ color: "gray" }}>
            {uploadStatus}
          </Typography>
        )}
      </Stack>

      <input
        ref={speciesInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => onSpeciesPicked(e.target.files?.[0] ?? null)}
      />

      <input
        ref={collectionInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => onCollectionPicked(e.target.files?.[0] ?? null)}
      />

      <TextField
        label="Collection ID"
        value={collectionID}
        onChange={(e) => setCollectionID(e.target.value)}
        fullWidth
        sx={{
          input: { color: "white" },
          label: { color: "gray" },
        }}
      />

      <Button variant="contained" onClick={handleFetch} disabled={!collectionID.trim()}>
        Fetch Collection
      </Button>

      {error && <Typography color="error">{error}</Typography>}

      {data && (
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <Stack spacing={2} sx={{ width: 380, flexShrink: 0 }}>
            <Paper sx={{ p: 1 }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateCalendar value={selectedDate} readOnly />
              </LocalizationProvider>
            </Paper>

            <Paper sx={{ p: 1 }}>
              <Typography variant="subtitle1" sx={{ px: 1, pb: 1 }}>
                Map
              </Typography>

              {mapCenter ? (
                <Box sx={{ height: 320, width: "100%" }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={12}
                    style={{ height: "100%", width: "100%" }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <CircleMarker center={mapCenter} radius={8}>
                      <Popup>
                        {coords!.lat.toFixed(6)}, {coords!.lng.toFixed(6)}
                      </Popup>
                    </CircleMarker>
                  </MapContainer>
                </Box>
              ) : (
                <Typography sx={{ px: 1, pb: 1 }} color="text.secondary">
                  No valid coords found in “Cords”.
                </Typography>
              )}
            </Paper>
          </Stack>

          <TableContainer component={Paper} sx={{ flex: 1 }}>
            <Table size="small">
              <TableBody>
                {Object.entries(data).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell sx={{ fontWeight: 600, width: 260 }}>{key}</TableCell>
                    <TableCell>{value === null ? "—" : String(value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Stack>
  )
}

export default App
