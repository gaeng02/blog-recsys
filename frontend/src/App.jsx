import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from '@/components/Header'
import Home from '@/components/Home'
import PostDetail from '@/components/PostDetail'
import CreatePost from '@/components/CreatePost'
import EditPost from '@/components/EditPost'
import PostsList from '@/components/PostsList'

function App() {
  return (
    <Router>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/create" element={<CreatePost />} />
          <Route path="/edit/:id" element={<EditPost />} />
          <Route path="/posts" element={<PostsList />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
