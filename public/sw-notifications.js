self.addEventListener('push', event => {
  let payload = { title: 'Gleba', body: event.data ? event.data.text() : '', url: '/', tag: 'gleba-notification' }
  try {
    const parsed = event.data ? event.data.json() : null
    if (parsed && typeof parsed === 'object') payload = { ...payload, ...parsed }
  } catch {
    // Le corps texte reste le message de secours si le JSON est invalide.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const matchingClient = windowClients.find(client => client.url === url)
      if (matchingClient) return matchingClient.focus()
      return self.clients.openWindow(url)
    })
  )
})
