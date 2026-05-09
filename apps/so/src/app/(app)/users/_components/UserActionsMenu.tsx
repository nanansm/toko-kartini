'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, MoreHorizontal, Key, Trash2, Shield, Eye, EyeOff } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  resetUserPassword,
  deleteUser,
  updateUserRole,
  type NewUserRole,
} from '@/lib/auth/user-management';

const ROLES: { value: NewUserRole; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'STAF_GUDANG', label: 'Staf Gudang' },
];

interface Props {
  userId: string;
  userName: string;
  currentRole: NewUserRole;
}

export function UserActionsMenu({ userId, userName, currentRole }: Props) {
  const router = useRouter();
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState<NewUserRole>(currentRole);
  const [submitting, setSubmitting] = useState(false);

  async function handleResetPassword() {
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    setSubmitting(true);
    const result = await resetUserPassword({ userId, newPassword });
    setSubmitting(false);
    if (result.ok) {
      toast.success(`Password ${userName} berhasil direset`);
      setResetOpen(false);
      setNewPassword('');
      setShowPassword(false);
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    const result = await deleteUser(userId);
    setSubmitting(false);
    if (result.ok) {
      toast.success(`${userName} berhasil dihapus`);
      setDeleteOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleRoleUpdate() {
    setSubmitting(true);
    const result = await updateUserRole({ userId, role: newRole });
    setSubmitting(false);
    if (result.ok) {
      toast.success(`Role ${userName} diubah`);
      setRoleOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
            aria-label="Aksi user"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="font-normal text-xs text-stone-500 truncate">
            {userName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setNewRole(currentRole);
              setRoleOpen(true);
            }}
          >
            <Shield className="w-4 h-4 mr-2" />
            Ubah Role
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setResetOpen(true);
            }}
          >
            <Key className="w-4 h-4 mr-2" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
            className="text-red-600 focus:text-red-700 focus:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Hapus User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set password baru untuk <strong>{userName}</strong>. Sesi aktif user akan otomatis
              logout.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password baru (min 6 karakter)"
              autoComplete="new-password"
              className="w-full h-10 pl-3 pr-10 rounded-lg border border-stone-200 focus:border-kartini-green focus:ring-2 focus:ring-kartini-green/20 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setResetOpen(false)}
              className="h-10 px-4 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={submitting || newPassword.length < 6}
              className="h-10 px-4 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Reset
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah Role</DialogTitle>
            <DialogDescription>
              Ubah role untuk <strong>{userName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Select value={newRole} onValueChange={(v) => setNewRole(v as NewUserRole)}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRoleOpen(false)}
              className="h-10 px-4 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleRoleUpdate}
              disabled={submitting || newRole === currentRole}
              className="h-10 px-4 rounded-lg bg-kartini-green hover:bg-kartini-green-dark text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Simpan
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus User?</DialogTitle>
            <DialogDescription>
              <strong>{userName}</strong> akan dihapus permanen dan tidak bisa login lagi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="h-10 px-4 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="h-10 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Hapus
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
