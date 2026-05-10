import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuthStore } from '../store/auth'
import { User, Bell, Lock, Globe, Shield, CreditCard, Download, Video, Volume2, Palette, Languages, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    email: user?.email || '',
  })
  const [qualitySettings, setQualitySettings] = useState({
    videoQuality: 'auto',
    audioQuality: 'high',
    downloadQuality: 'medium',
    autoPlay: true,
    dataSaver: false,
  })
  const [theme, setTheme] = useState('light')
  const [language, setLanguage] = useState('en')
  const [privacySettings, setPrivacySettings] = useState({
    privateProfile: false,
    showOnlineStatus: true,
    allowMessagesFromEveryone: true,
    showActivity: true,
    searchable: true,
  })
  const [accessibilitySettings, setAccessibilitySettings] = useState({
    autoCaptions: false,
    audioDescriptions: false,
    highContrast: false,
    reducedMotion: false,
  })
  const [contentPreferences, setContentPreferences] = useState({
    showMatureContent: false,
    showSponsoredContent: true,
    personalizedRecommendations: true,
  })
  const queryClient = useQueryClient()

  const updateProfileMutation = useMutation({
    mutationFn: (data) => api.put(`/users/${user?.id}`, data),
    onSuccess: (res) => {
      setUser(res.data)
      queryClient.invalidateQueries(['user', user?.id])
      toast.success('Profile updated successfully!')
    },
    onError: () => {
      toast.error('Failed to update profile')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    updateProfileMutation.mutate(formData)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile Settings
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={updateProfileMutation.isLoading}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {updateProfileMutation.isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Video className="w-5 h-5" />
          Video & Audio Quality
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Quality
            </label>
            <select
              value={qualitySettings.videoQuality}
              onChange={(e) => setQualitySettings({ ...qualitySettings, videoQuality: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="auto">Auto</option>
              <option value="4k">4K (2160p)</option>
              <option value="1080p">Full HD (1080p)</option>
              <option value="720p">HD (720p)</option>
              <option value="480p">SD (480p)</option>
              <option value="360p">Low (360p)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio Quality
            </label>
            <select
              value={qualitySettings.audioQuality}
              onChange={(e) => setQualitySettings({ ...qualitySettings, audioQuality: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="high">High (320kbps)</option>
              <option value="medium">Medium (192kbps)</option>
              <option value="low">Low (128kbps)</option>
            </select>
          </div>
          <label className="flex items-center justify-between">
            <span>Auto-play videos</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={qualitySettings.autoPlay}
              onChange={(e) => setQualitySettings({ ...qualitySettings, autoPlay: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Data saver mode</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={qualitySettings.dataSaver}
              onChange={(e) => setQualitySettings({ ...qualitySettings, dataSaver: e.target.checked })}
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Download Quality
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Download Quality
            </label>
            <select
              value={qualitySettings.downloadQuality}
              onChange={(e) => setQualitySettings({ ...qualitySettings, downloadQuality: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="4k">4K (2160p)</option>
              <option value="1080p">Full HD (1080p)</option>
              <option value="720p">HD (720p)</option>
              <option value="480p">SD (480p)</option>
            </select>
          </div>
          <p className="text-sm text-gray-500">
            Higher quality downloads use more storage space and bandwidth.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Appearance
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`px-4 py-2 rounded-lg border ${theme === 'light' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
              >
                Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`px-4 py-2 rounded-lg border ${theme === 'dark' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
              >
                Dark
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`px-4 py-2 rounded-lg border ${theme === 'system' ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}`}
              >
                System
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Languages className="w-5 h-5" />
          Language & Region
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="zh">中文</option>
              <option value="ja">日本語</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Accessibility
        </h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span>Auto-generate captions</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={accessibilitySettings.autoCaptions}
              onChange={(e) => setAccessibilitySettings({ ...accessibilitySettings, autoCaptions: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Audio descriptions</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={accessibilitySettings.audioDescriptions}
              onChange={(e) => setAccessibilitySettings({ ...accessibilitySettings, audioDescriptions: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>High contrast mode</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={accessibilitySettings.highContrast}
              onChange={(e) => setAccessibilitySettings({ ...accessibilitySettings, highContrast: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Reduced motion</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={accessibilitySettings.reducedMotion}
              onChange={(e) => setAccessibilitySettings({ ...accessibilitySettings, reducedMotion: e.target.checked })}
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          Privacy Settings
        </h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span>Private profile</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={privacySettings.privateProfile}
              onChange={(e) => setPrivacySettings({ ...privacySettings, privateProfile: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Show online status</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={privacySettings.showOnlineStatus}
              onChange={(e) => setPrivacySettings({ ...privacySettings, showOnlineStatus: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Allow messages from everyone</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={privacySettings.allowMessagesFromEveryone}
              onChange={(e) => setPrivacySettings({ ...privacySettings, allowMessagesFromEveryone: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Show activity status</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={privacySettings.showActivity}
              onChange={(e) => setPrivacySettings({ ...privacySettings, showActivity: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Profile searchable</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={privacySettings.searchable}
              onChange={(e) => setPrivacySettings({ ...privacySettings, searchable: e.target.checked })}
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          Content Preferences
        </h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span>Show mature content</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={contentPreferences.showMatureContent}
              onChange={(e) => setContentPreferences({ ...contentPreferences, showMatureContent: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Show sponsored content</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={contentPreferences.showSponsoredContent}
              onChange={(e) => setContentPreferences({ ...contentPreferences, showSponsoredContent: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Personalized recommendations</span>
            <input 
              type="checkbox" 
              className="w-5 h-5"
              checked={contentPreferences.personalizedRecommendations}
              onChange={(e) => setContentPreferences({ ...contentPreferences, personalizedRecommendations: e.target.checked })}
            />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Security Settings
        </h2>
        <button className="text-primary-600 hover:underline mb-4">
          Change password
        </button>
        <button className="text-primary-600 hover:underline block">
          Enable two-factor authentication
        </button>
      </div>
    </div>
  )
}
