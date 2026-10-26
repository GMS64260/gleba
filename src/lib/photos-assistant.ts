/** Contrat commun navigateur / serveur : petites photos, jamais d'URL distante. */
export const MAX_PHOTOS_ASSISTANT = 3
export const MAX_OCTETS_PHOTO_ASSISTANT = 700 * 1024
export const MAX_CORPS_CHAT = 3 * 1024 * 1024
export const COTE_MAX_PHOTO_ASSISTANT = 1600

export interface PhotoEnvoi {
  dataUrl: string
}

export interface PhotoConversation {
  id: string
  url: string
  width: number
  height: number
}

export const QUESTION_PHOTOS_SEULES =
  'Aide-moi à comprendre ces photos : identifie ce qui est visible, les problèmes éventuels et les vérifications utiles sur le terrain.'

/** Une photo d'appareil est réencodée avant l'envoi : taille et EXIF réduits. */
export async function preparerPhotoAssistant(file: File): Promise<PhotoEnvoi> {
  const type = file.type.toLowerCase()
  if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/.test(type) && !(type === '' && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))) {
    throw new Error('Choisissez une photo JPEG, PNG, WebP ou une photo HEIC lisible par votre appareil.')
  }
  if (!file.size || file.size > 20 * 1024 * 1024) {
    throw new Error('La photo doit faire moins de 20 Mo. Choisissez une version plus légère.')
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode().catch(() => { throw new Error('Cette photo est illisible sur cet appareil. Essayez une autre image ou exportez-la en JPEG.') })
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 50_000_000) {
      throw new Error('Image trop grande. Choisissez une photo de moins de 50 mégapixels.')
    }
    const canvas = document.createElement('canvas')
    let cote = COTE_MAX_PHOTO_ASSISTANT
    for (const qualite of [0.85, 0.75, 0.65]) {
      const ratio = Math.min(1, cote / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Préparation de la photo impossible dans ce navigateur.')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', qualite))
      if (blob && blob.size <= MAX_OCTETS_PHOTO_ASSISTANT) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('Lecture de la photo impossible.'))
          reader.readAsDataURL(blob)
        })
        return { dataUrl }
      }
      cote = Math.round(cote * 0.85)
    }
    throw new Error('Photo trop lourde après compression. Recadrez-la ou choisissez une autre photo.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
