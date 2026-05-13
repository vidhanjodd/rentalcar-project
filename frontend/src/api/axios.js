import axios from 'axios'

// Module-level token storage — avoids window pollution, still inaccessible to other modules
let _accessToken = null
let _navigate = null

export const setAccessToken = (token) => { _accessToken = token }
export const clearAccessToken = () => { _accessToken = null }
// Called once from AuthProvider (inside BrowserRouter) so interceptor can do soft navigation
export const setNavigate = (fn) => { _navigate = fn }

const redirectToLogin = () => {
  if (_navigate) _navigate('/login', { replace: true })
  else window.location.href = '/login'
}

const api = axios.create({
  baseURL: 'http://localhost:8080',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,   // sends the httpOnly refresh_token cookie on every request
})

api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`
  return config
})

let isRefreshing = false
let queue = []

const processQueue = (error, token) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)))
  queue = []
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`
            return api(original)
          })
          .catch((e) => Promise.reject(e))
      }
      original._retry = true
      isRefreshing = true
      try {
        // Cookie is sent automatically — no body needed, no localStorage read
        const { data } = await axios.post(
          'http://localhost:8080/api/auth/refresh',
          {},
          { withCredentials: true }
        )
        _accessToken = data.accessToken
        processQueue(null, data.accessToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch (e) {
        processQueue(e, null)
        _accessToken = null
        redirectToLogin()
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

export default api
