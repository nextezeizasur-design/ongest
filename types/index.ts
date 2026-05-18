// ─── Primitives ───────────────────────────────────────────────
export type RoleName   = 'director' | 'coordinator' | 'secretary' | 'teacher' | 'student'
export type CefrCode   = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type EvalStatus = 'draft' | 'published' | 'closed'
export type EvalType   = 'multiple_choice' | 'writing' | 'listening' | 'mixed'
export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'short_answer' | 'essay' | 'audio' | 'speaking'
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded' | 'timed_out' | 'flagged'

// ─── Organization ─────────────────────────────────────────────
export interface Organization {
  id: string
  name: string
  slug: string
  logo_url?: string
  primary_color: string
  is_active: boolean
  created_at: string
}

// ─── Profile ──────────────────────────────────────────────────
export interface Profile {
  id: string
  organization_id: string
  role_id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
  roles?: { name: RoleName }
}

export type ProfileWithRole = Profile & { role: RoleName }

// ─── Course ───────────────────────────────────────────────────
export interface CefrLevel {
  id: number
  code: CefrCode
  label: string
  sort_order: number
}

export interface Course {
  id: string
  organization_id: string
  name: string
  description?: string
  schedule_days?: string
  schedule_time?: string
  bibliography?: string
  notes?: string
  cefr_level_id?: number
  teacher_id?: string
  is_active: boolean
  created_at: string
  cefr_levels?: CefrLevel | null
  profiles?: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'email'> | null
  _count?: { enrollments: number }
}

// ─── Evaluation ───────────────────────────────────────────────
export interface Evaluation {
  id: string
  organization_id: string
  title: string
  description?: string
  instructions?: string
  cefr_level_id?: number
  eval_type: EvalType
  time_limit_min?: number
  max_attempts: number
  pass_score: number
  available_from?: string
  available_until?: string
  status: EvalStatus
  created_by?: string
  created_at: string
  updated_at: string
  cefr_levels?: CefrLevel
  profiles?: Pick<Profile, 'first_name' | 'last_name'>
}

// ─── Questions & Options ──────────────────────────────────────
export interface Option {
  id: string
  question_id: string
  body: string
  is_correct: boolean
  sort_order: number
}

export interface Question {
  id: string
  evaluation_id: string
  sort_order: number
  q_type: QuestionType
  body: string
  image_url?: string
  audio_url?: string
  points: number
  explanation?: string
  options?: Option[]
}

// ─── Attempt ──────────────────────────────────────────────────
export interface Attempt {
  id: string
  evaluation_id: string
  student_id: string
  started_at: string
  submitted_at?: string
  graded_at?: string
  graded_by?: string
  status: AttemptStatus
  score?: number
  passed?: boolean
  time_taken_sec?: number
  teacher_feedback?: string
  evaluations?: Pick<Evaluation, 'id' | 'title' | 'pass_score' | 'time_limit_min'>
  profiles?: Pick<Profile, 'first_name' | 'last_name' | 'email'>
}

// ─── Answer ───────────────────────────────────────────────────
export interface Answer {
  id: string
  attempt_id: string
  question_id: string
  option_id?: string
  text_answer?: string
  is_correct?: boolean
  points_earned: number
  grader_note?: string
  answered_at: string
}

// ─── View types ───────────────────────────────────────────────
export interface StudentStats {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  cefr_code?: CefrCode
  cefr_label?: string
  course_name?: string
  course_id?: string
  total_attempts: number
  avg_score?: number
  passed_count: number
  failed_count: number
}

export interface EvaluationStats {
  id: string
  organization_id: string
  title: string
  eval_type: EvalType
  status: EvalStatus
  time_limit_min?: number
  available_until?: string
  pass_score: number
  cefr_code?: CefrCode
  created_by_name?: string
  completed_count: number
  unique_students: number
  avg_score?: number
  min_score?: number
  max_score?: number
  in_progress_count: number
}

// ─── Dashboard ────────────────────────────────────────────────
export interface DirectorDashboardData {
  totalStudents: number
  activeEvaluations: number
  totalAttempts: number
  avgScore: number
  studentsAtRisk: number
  recentEvals: EvaluationStats[]
  recentStudents: StudentStats[]
}

// ─── API Responses ────────────────────────────────────────────
export interface ApiSuccess<T> {
  data: T
  error: null
}
export interface ApiError {
  data: null
  error: string
}
export type ApiResult<T> = ApiSuccess<T> | ApiError
