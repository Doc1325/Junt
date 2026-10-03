export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

export type Group = {
  id: string
  name: string
  created_by: string
  created_at: string
}

export type GroupMember = {
  group_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export type Plan = {
  id: string
  group_id: string
  title: string
  description: string | null
  scheduled_at: string
  status: 'voting' | 'confirmed' | 'completed' | 'cancelled'
  selected_option_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  group?: Pick<Group, 'name'>
}

export type PlanOption = {
  id: string
  plan_id: string
  title: string
  created_by: string
  created_at: string
  votes?: Vote[]
}

export type Vote = {
  option_id: string
  user_id: string
  created_at: string
}

export type PlanParticipant = {
  plan_id: string
  user_id: string
  attendance_status: 'going' | 'maybe' | 'not_going'
  updated_at: string
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}

export type VirtualRoom = {
  id: string
  plan_id: string
  host_id: string
  room_name: string
  provider: string
  created_at: string
  plan?: Pick<Plan, 'id' | 'title' | 'group_id'>
}

export type WatchMessage = {
  id: string
  room_id: string
  user_id: string
  message: string
  created_at: string
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
}
