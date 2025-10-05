import type { PageView } from '../../index'

const page: PageView = () => {
  return new Response('Not authorized', { status: 403 })
}

export default page
