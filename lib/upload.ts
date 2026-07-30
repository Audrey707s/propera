import { createClient } from '@/lib/supabase/client'

export async function uploadImage(
  file: File,
  bucket: 'avatars' | 'property-images',
  path: string
): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const filePath = `${path}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true })
  if (error) { console.error('Upload error:', error); return null }
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return `${data.publicUrl}?t=${Date.now()}`
}