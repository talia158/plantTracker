import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material"
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet"
import type { LatLngExpression } from "leaflet"

type Bounds = {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

type CollectionMarker = {
  collection_code: string
  common_name: string | null
  latitude: number
  longitude: number
  county: string | null
  date_collected: string | null
}

type CollectionListResponse = {
  items: CollectionMarker[]
  total: number
  limit: number
  offset: number
}

type CollectionDetail = Record<string, any>

function MapMoveListener({ onMove }: { onMove: (b: Bounds) => void }) {
  // Watch for map movements and report the visible bounds
  const map = useMapEvents({
    moveend() {
      const b = map.getBounds()
      onMove({
        minLat: b.getSouth(),
        maxLat: b.getNorth(),
        minLng: b.getWest(),
        maxLng: b.getEast(),
      })
    },
  })

  useEffect(() => {
    // Emit initial bounds on mount so the first fetch can run
    const b = map.getBounds()
    onMove({
      minLat: b.getSouth(),
      maxLat: b.getNorth(),
      minLng: b.getWest(),
      maxLng: b.getEast(),
    })
  }, [map, onMove])

  return null
}

function MapSearchPage() {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [markers, setMarkers] = useState<CollectionMarker[]>([])
  const [total, setTotal] = useState(0)
  const limit = 200
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CollectionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const center = useMemo<LatLngExpression>(() => [39.5, -98.35], [])
  const sortedMarkers = useMemo(() => {
    return [...markers].sort((a, b) => {
      const aLabel = a.common_name || a.collection_code
      const bLabel = b.common_name || b.collection_code
      return aLabel.localeCompare(bLabel)
    })
  }, [markers])

  useEffect(() => {
    if (!bounds) return
    // Fetch collections within the current map bounds
    const fetchCollections = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await axios.get<CollectionListResponse>("/api/collections", {
          params: {
            minLat: bounds.minLat,
            maxLat: bounds.maxLat,
            minLng: bounds.minLng,
            maxLng: bounds.maxLng,
            limit,
            offset,
          },
        })
        setMarkers(res.data.items)
        setTotal(res.data.total)
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.detail || `request failed with status ${err.response?.status}`)
        } else {
          setError("unknown error")
        }
        setMarkers([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }
    fetchCollections()
  }, [bounds, offset, limit])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1

  // Reset pagination when the user pans/zooms the map
  const onBoundsChange = useCallback((b: Bounds) => {
    setBounds(b)
    setOffset(0)
  }, [])

  // Load full details for a collection when requested from a popup
  const loadDetails = async (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const res = await axios.get(`/api/collection/${id}`)
      setDetail(res.data)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setDetailError(
          err.response?.data?.detail || `detail request failed with status ${err.response?.status}`,
        )
      } else {
        setDetailError("unknown error loading details")
      }
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2, width: "200%" }}>
        <Typography variant="h6" gutterBottom>
          Map Search
        </Typography>

        <Box sx={{ display: "flex", gap: 2, alignItems: "stretch", width: "100%" }}>
          <Box sx={{ height: 420, borderRadius: 1, overflow: "hidden", flex: 1 }}>
            <MapContainer
              center={center}
              zoom={5}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapMoveListener onMove={onBoundsChange} />
              {markers.map((m) => (
                <CircleMarker key={m.collection_code} center={[m.latitude, m.longitude]} radius={8}>
                  <Popup>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">{m.collection_code}</Typography>
                      <Typography variant="body2">
                        {m.common_name || "Unknown"} | {m.county || "—"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {m.date_collected || "No date"}
                      </Typography>
                      <Button size="small" onClick={() => loadDetails(m.collection_code)}>
                        View details
                      </Button>
                    </Stack>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </Box>

          <Paper
            variant="outlined"
            sx={{ width: 300, height: 420, overflow: "auto", flexShrink: 0 }}
          >
            <List dense disablePadding>
              {sortedMarkers.map((m, index) => (
                <Box key={m.collection_code}>
                  <ListItemButton
                    selected={selectedId === m.collection_code}
                    onClick={() => loadDetails(m.collection_code)}
                  >
                    <ListItemText
                      primary={m.common_name || m.collection_code}
                      secondary={`${m.collection_code} • ${m.county || "—"} • ${
                        m.date_collected || "No date"
                      }`}
                    />
                  </ListItemButton>
                  {index < sortedMarkers.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </Paper>
        </Box>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {markers.length} of {total} in view
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              disabled={currentPage <= 1 || loading}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Prev
            </Button>
            <Typography variant="body2">
              Page {currentPage} / {totalPages}
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </Stack>

          {loading && <CircularProgress size={20} />}
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, width: "200%" }}>
        <Typography variant="h6" gutterBottom>
          Details
        </Typography>
        {detailLoading && <Typography>Loading…</Typography>}
        {detailError && <Typography color="error">{detailError}</Typography>}
        {!detailLoading && !detailError && !detail && (
          <Typography color="text.secondary">Select a marker and choose “View details”.</Typography>
        )}
        {detail && (
          <TableContainer>
            <Table size="small">
              <TableBody>
                {Object.entries(detail).map(([key, value]) => (
                  <TableRow key={key} selected={selectedId === detail["Collection Code"]}>
                    <TableCell sx={{ fontWeight: 600, width: 240 }}>{key}</TableCell>
                    <TableCell>{value === null ? "—" : String(value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  )
}

export default MapSearchPage
