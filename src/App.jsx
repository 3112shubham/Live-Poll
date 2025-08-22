import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LivePoll from './livePoll'
import Admin from './admin'
import Result from './result'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LivePoll />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/results" element={<Result />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App