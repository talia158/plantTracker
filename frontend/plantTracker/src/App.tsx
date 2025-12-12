import { useState } from "react"
import axios from "axios"
import { TextField, Button, Stack, Typography } from "@mui/material"

function App() {
  const [collectionID, setCollectionID] = useState("")
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Stack spacing={2} sx={{ maxWidth: 520, mx: "auto", mt: 6, px: 2 }}>
      <Typography variant="h5">PlantTracker</Typography>

      <TextField
        label="Collection ID"
        value={collectionID}
        onChange={(e) => setCollectionID(e.target.value)}
        fullWidth
        sx={{
          input: { color: "white" },
          label: { color: "white" },
        }}
      />


      <Button variant="contained" onClick={handleFetch} disabled={!collectionID.trim()}>
        Fetch Collection
      </Button>

      {error && <Typography color="error">{error}</Typography>}
      {data && <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>}
    </Stack>
  )
}

export default App
