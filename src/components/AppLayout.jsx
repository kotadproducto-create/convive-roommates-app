import Sidebar from './Sidebar'
import Topbar from './Topbar'
import JoinRequestPopup from './JoinRequestPopup'

export default function AppLayout({ title, subheader, children }) {
  return (
    <div className="flex min-h-screen">
      <JoinRequestPopup />
      <Sidebar />
      <div className="flex-1 min-w-0">
        <Topbar title={title} subheader={subheader} />
        <main className="p-5 landscape-sm:p-3 pb-24 landscape-sm:pb-16 md:pb-8 max-w-5xl mx-auto">{children}</main>
      </div>
    </div>
  )
}
