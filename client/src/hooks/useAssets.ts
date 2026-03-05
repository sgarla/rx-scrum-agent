import { useCallback, useEffect, useState } from 'react'
import { fetchStoryAssets, groupAssetsBySessions } from '../lib/api'
import type { Asset, AssetSession } from '../lib/types'

export function useAssets(
  _conversationId: string | null,  // kept for API compat but not used
  storyKey: string | null,
  isBuilding: boolean
) {
  const [sessions, setSessions] = useState<AssetSession[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!storyKey) return
    setLoading(true)
    try {
      const { assets: flat } = await fetchStoryAssets(storyKey)
      setAssets(flat)
      setSessions(groupAssetsBySessions(flat))
    } catch (err) {
      console.error('Failed to load assets', err)
    } finally {
      setLoading(false)
    }
  }, [storyKey])

  useEffect(() => {
    setAssets([])
    setSessions([])
    load()
  }, [storyKey])

  // Poll while building
  useEffect(() => {
    if (!isBuilding) return
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [isBuilding, load])

  return { assets, sessions, loading, reload: load }
}
