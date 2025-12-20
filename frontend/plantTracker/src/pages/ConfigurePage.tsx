import { useRef, useState } from "react"
import axios from "axios"
import { Button, Paper, Stack, Typography } from "@mui/material"

function ConfigurePage() {
  const [speciesFile, setSpeciesFile] = useState<File | null>(null)
  const [collectionFile, setCollectionFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const speciesInputRef = useRef<HTMLInputElement | null>(null)
  const collectionInputRef = useRef<HTMLInputElement | null>(null)

  // Trigger a hidden file input for the species CSV, resetting previous picks
  const pickSpeciesCsv = () => {
    setError(null)
    setUploadStatus(null)
    if (speciesInputRef.current) speciesInputRef.current.value = ""
    speciesInputRef.current?.click()
  }

  // Trigger a hidden file input for the collection CSV, resetting previous picks
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

  // Send both CSVs to the backend in one multipart request
  const uploadBoth = async () => {
    if (!speciesFile || !collectionFile) return

    setUploading(true)
    setUploadStatus("Uploading...")
    setError(null)

    try {
      const form = new FormData()
      form.append("species_csv", speciesFile)
      form.append("collection_csv", collectionFile)

      await axios.post("/api/upload", form, {
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
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Configure Data
      </Typography>

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
        {error && (
          <Typography variant="body2" color="error">
            {error}
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
    </Paper>
  )
}

export default ConfigurePage
