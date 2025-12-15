import { useState } from "react"
import { Button, Stack, Typography } from "@mui/material"
import SearchPage from "./pages/SearchPage"
import MapSearchPage from "./pages/MapSearchPage"
import ConfigurePage from "./pages/ConfigurePage"

function App() {
  type Page = "search" | "map" | "configure"
  const [activePage, setActivePage] = useState<Page>("search")

  return (
    <Stack spacing={2} sx={{ maxWidth: 1200, mx: "auto", mt: 6, px: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography variant="h5">PlantTracker</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant={activePage === "search" ? "contained" : "outlined"}
            onClick={() => setActivePage("search")}
          >
            Search by ID
          </Button>
          <Button
            variant={activePage === "map" ? "contained" : "outlined"}
            onClick={() => setActivePage("map")}
          >
            Map Search
          </Button>
          <Button
            variant={activePage === "configure" ? "contained" : "outlined"}
            onClick={() => setActivePage("configure")}
          >
            Configure
          </Button>
        </Stack>
      </Stack>

      {activePage === "search" && <SearchPage />}
      {activePage === "map" && <MapSearchPage />}
      {activePage === "configure" && <ConfigurePage />}
    </Stack>
  )
}

export default App
