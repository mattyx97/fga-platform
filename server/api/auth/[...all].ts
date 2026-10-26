export default defineEventHandler((event) => {
  return useBetterAuth().handler(toWebRequest(event))
})
