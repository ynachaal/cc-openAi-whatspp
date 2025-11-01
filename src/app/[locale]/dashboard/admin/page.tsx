'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Trash2, UserPlus, Edit, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  id: string
  name: string | null
  email: string | null
  role: string
  emailVerified: Date | null
  image: string | null
  accounts: { provider: string }[]
  sessions: { expires: Date }[]
}

interface CreateUserForm {
  name: string
  email: string
  password: string
  role: 'USER' | 'ADMIN'
}

interface UpdatePasswordForm {
  password: string
  confirmPassword: string
}

  interface UpdateUserForm {
  name: string
  email: string
  role: 'USER' | 'ADMIN'
}

export default function AdminPanel() {
  const { data: session, status } = useSession()
  const t = useTranslations('admin')
  const router = useRouter()
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [updatePasswordOpen, setUpdatePasswordOpen] = useState(false)
  const [updateUserOpen, setUpdateUserOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'USER'
  })

  const [passwordForm, setPasswordForm] = useState<UpdatePasswordForm>({
    password: '',
    confirmPassword: ''
  })

  const [updateUserForm, setUpdateUserForm] = useState<UpdateUserForm>({
    name: '',
    email: '',
    role: 'USER'
  })

  // Redirect if not admin
  useEffect(() => {
    if (status === 'loading') return

    if (!session || session.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
  }, [session, status, router])

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users')
      
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: t('error'),
        description: t('fetchUsersError'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchUsers()
    }
  }, [session])

  // Create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!createForm.name || !createForm.email || !createForm.password) {
      toast({
        title: t('error'),
        description: t('fillAllFields'),
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create user')
      }

      toast({
        title: t('success'),
        description: t('userCreatedSuccess'),
      })

      setCreateForm({ name: '', email: '', password: '', role: 'USER' })
      setCreateUserOpen(false)
      fetchUsers()
    } catch (error: any) {
      console.error('Error creating user:', error)
      toast({
        title: t('error'),
        description: error.message || t('createUserError'),
        variant: 'destructive',
      })
    }
  }

  // Update user
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!updateUserForm.name || !updateUserForm.email) {
      toast({
        title: t('error'),
        description: t('fillAllFields'),
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${selectedUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateUserForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user')
      }

      toast({
        title: t('success'),
        description: t('userUpdatedSuccess'),
      })

      setUpdateUserForm({ name: '', email: '', role: 'USER' })
      setUpdateUserOpen(false)
      setSelectedUserId('')
      setSelectedUser(null)
      fetchUsers()
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast({
        title: t('error'),
        description: error.message || t('updateUserError'),
        variant: 'destructive',
      })
    }
  }

  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!passwordForm.password || !passwordForm.confirmPassword) {
      toast({
        title: t('error'),
        description: t('fillAllFields'),
        variant: 'destructive',
      })
      return
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast({
        title: t('error'),
        description: t('passwordsDoNotMatch'),
        variant: 'destructive',
      })
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${selectedUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: passwordForm.password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update password')
      }

      toast({
        title: t('success'),
        description: t('passwordUpdatedSuccess'),
      })

      setPasswordForm({ password: '', confirmPassword: '' })
      setUpdatePasswordOpen(false)
      setSelectedUserId('')
      fetchUsers()
    } catch (error: any) {
      console.error('Error updating password:', error)
      toast({
        title: t('error'),
        description: error.message || t('updatePasswordError'),
        variant: 'destructive',
      })
    }
  }

  // Delete user
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(t('deleteUserConfirm', { name: userName }))) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete user')
      }

      toast({
        title: t('success'),
        description: t('userDeletedSuccess'),
      })

      fetchUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast({
        title: t('error'),
        description: error.message || t('deleteUserError'),
        variant: 'destructive',
      })
    }
  }

  // Show loading or redirect if not admin
  if (status === 'loading' || !session || session.user?.role !== 'ADMIN') {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-foreground"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        
        <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              {t('createUser')}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-card-foreground">{t('createUser')}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {t('createUserDescription')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-card-foreground">{t('name')}</Label>
                <Input
                  id="name"
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-card-foreground">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="bg-background border-border text-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-card-foreground">{t('password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="bg-background border-border text-foreground pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-card-foreground">{t('role')}</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value: 'USER' | 'ADMIN') => setCreateForm({ ...createForm, role: value })}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="USER">{t('roleUser')}</SelectItem>
                    <SelectItem value="ADMIN">{t('roleAdmin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateUserOpen(false)}
                >
                  {t('cancel')}
                </Button>
                <Button type="submit">{t('createUser')}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-card-foreground">{t('userList')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('userListDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-foreground"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('noUsers')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-card-foreground">{t('name')}</th>
                    <th className="text-left py-3 px-4 text-card-foreground">{t('email')}</th>
                    <th className="text-left py-3 px-4 text-card-foreground">{t('role')}</th>
                    <th className="text-left py-3 px-4 text-card-foreground">{t('status')}</th>
                    <th className="text-left py-3 px-4 text-card-foreground">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4 text-card-foreground">
                        {user.name || t('noName')}
                      </td>
                      <td className="py-3 px-4 text-card-foreground">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            user.role === 'ADMIN'
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {user.role === 'ADMIN' ? t('roleAdmin') : t('roleUser')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            user.sessions.length > 0 && new Date(user.sessions[0].expires) > new Date()
                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                          )}
                        >
                          {user.sessions.length > 0 && new Date(user.sessions[0].expires) > new Date()
                            ? t('active')
                            : t('inactive')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user.id)
                              setSelectedUser(user)
                              setUpdateUserForm({
                                name: user.name || '',
                                email: user.email || '',
                                role: user.role as 'USER' | 'ADMIN'
                              })
                              setUpdateUserOpen(true)
                            }}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            {t('editUser')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user.id)
                              setUpdatePasswordOpen(true)
                            }}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            {t('changePassword')}
                          </Button>
                          {user.id !== session?.user?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id, user.name || user.email || '')}
                              className="flex items-center gap-1 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                              {t('delete')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Password Dialog */}
      <Dialog open={updatePasswordOpen} onOpenChange={setUpdatePasswordOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">{t('changePassword')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('changePasswordDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-card-foreground">{t('newPassword')}</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  className="bg-background border-border text-foreground pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-card-foreground">{t('confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="bg-background border-border text-foreground pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUpdatePasswordOpen(false)
                  setPasswordForm({ password: '', confirmPassword: '' })
                  setSelectedUserId('')
                }}
              >
                {t('cancel')}
              </Button>
              <Button type="submit">{t('updatePassword')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={updateUserOpen} onOpenChange={setUpdateUserOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-card-foreground">{t('editUser')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('editUserDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName" className="text-card-foreground">{t('name')}</Label>
              <Input
                id="editName"
                type="text"
                value={updateUserForm.name}
                onChange={(e) => setUpdateUserForm({ ...updateUserForm, name: e.target.value })}
                className="bg-background border-border text-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail" className="text-card-foreground">{t('email')}</Label>
              <Input
                id="editEmail"
                type="email"
                value={updateUserForm.email}
                onChange={(e) => setUpdateUserForm({ ...updateUserForm, email: e.target.value })}
                className="bg-background border-border text-foreground"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editRole" className="text-card-foreground">{t('role')}</Label>
              <Select
                value={updateUserForm.role}
                onValueChange={(value: 'USER' | 'ADMIN') => setUpdateUserForm({ ...updateUserForm, role: value })}
              >
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="USER">{t('roleUser')}</SelectItem>
                  <SelectItem value="ADMIN">{t('roleAdmin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setUpdateUserOpen(false)
                  setUpdateUserForm({ name: '', email: '', role: 'USER' })
                  setSelectedUserId('')
                  setSelectedUser(null)
                }}
              >
                {t('cancel')}
              </Button>
              <Button type="submit">{t('updateUser')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
