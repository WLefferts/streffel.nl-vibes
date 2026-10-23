import { Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Stars from './components/Stars';
import Home from './pages/Home';
import Login from './pages/Login';
import Editor from './pages/Editor';

export default function App() {
  const { isOwner, logout } = useAuth();

  return (
    <>
      <Stars />
      <header className="intro">
        <h1>
          <Link to="/">Welcome to Streffel's Space Blog</Link>
        </h1>
        <p>
          Here, you'll find stunning images of space that I have captured through a telescope, showcasing the wonders that float above us.
        </p>
        <p>Take a moment to explore and enjoy the beauty of the cosmos. Click on any image to view it in full resolution.</p>
        {isOwner && (
          <nav className="admin-bar">
            <Link className="btn" to="/new">New post</Link>
            <button className="btn ghost" onClick={logout}>Log out</button>
          </nav>
        )}
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/new" element={<Editor />} />
          <Route path="/edit/:id" element={<Editor />} />
          <Route path="*" element={<p className="notice">Page not found.</p>} />
        </Routes>
      </main>

      {!isOwner && (
        <footer>
          <Link to="/login">Log in</Link>
        </footer>
      )}
    </>
  );
}
