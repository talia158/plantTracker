import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import axios from "axios"

function App() {
  const [count, setCount] = useState(0)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const collectionID = "C0001"

    axios
      .get(`http://localhost:8000/api/collection/${collectionID}`)
      .then((res) => {
        setData(res.data)
      })
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.detail || `request failed with status ${err.response?.status}`)
        } else {
          setError("unknown error")
        }
      })
  }, [])

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <h1>Vite + React</h1>

      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>

        {error && <p style={{ color: "red" }}>{error}</p>}
        {data && <pre>{JSON.stringify(data, null, 2)}</pre>}

        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>

      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
