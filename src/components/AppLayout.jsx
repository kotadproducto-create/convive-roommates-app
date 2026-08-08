import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout({ title, children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar title={title} />
        <main className="p-5 pb-24 md:pb-8 max-w-5xl mx-auto">{children}</main>
      </div>
    </div>
  )
}
