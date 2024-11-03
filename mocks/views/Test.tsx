import type { PageView } from '../../index'

const page: PageView = ({ page }) => {
  return <p>Hello {page.name}!</p>
}

export default page
