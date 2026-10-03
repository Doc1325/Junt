import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Group, Plan, PlanOption, PlanParticipant, WatchMessage, VirtualRoom } from '../types'

export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  onboarded: boolean
  created_at: string
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    },
    staleTime: Infinity,
  })
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, onboarded, created_at')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return data as Profile
    },
  })
}

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Pick<Group, 'id' | 'name' | 'created_at'>[]
    },
  })
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('id, name, created_by, created_at')
        .eq('id', groupId)
        .single()
      if (groupError) throw groupError

      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('user_id, role, joined_at, profiles(id, full_name, avatar_url)')
        .eq('group_id', groupId)
      if (membersError) throw membersError

      const { data: plans, error: plansError } = await supabase
        .from('plans')
        .select('id, title, scheduled_at, status, created_by, selected_option_id')
        .eq('group_id', groupId)
        .order('scheduled_at', { ascending: true })
      if (plansError) throw plansError

      return { group, members: members || [], plans: plans || [] }
    },
  })
}

export function useVirtualRoom(planId: string) {
  return useQuery({
    queryKey: ['virtualRoom', planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_rooms')
        .select('*')
        .eq('plan_id', planId)
        .single()
      if (error) throw error
      return data as VirtualRoom
    },
    enabled: !!planId,
  })
}

export function useWatchMessages(roomId: string) {
  return useQuery({
    queryKey: ['watchMessages', roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watch_messages')
        .select('*, profiles(id, full_name, avatar_url)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      return (data || []) as WatchMessage[]
    },
    enabled: !!roomId,
    refetchInterval: 5000,
  })
}

export function usePlan(planId: string) {
  return useQuery({
    queryKey: ['plan', planId],
    queryFn: async () => {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('*, group:group_id(name)')
        .eq('id', planId)
        .single()
      if (planError) throw planError

      const { data: options, error: optionsError } = await supabase
        .from('plan_options')
        .select('*, votes(*)')
        .eq('plan_id', planId)
      if (optionsError) throw optionsError

      const { data: participants, error: participantsError } = await supabase
        .from('plan_participants')
        .select('*')
        .eq('plan_id', planId)
      if (participantsError) throw participantsError

      return {
        plan: plan as Plan,
        options: (options || []) as PlanOption[],
        participants: (participants || []) as PlanParticipant[],
      }
    },
  })
}