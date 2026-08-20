
CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  year          TEXT NOT NULL,
  created_at    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS students_email_idx ON students (email);
CREATE INDEX IF NOT EXISTS students_username_idx ON students (username);

CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  year        TEXT NOT NULL,
  cover       TEXT,
  created_at  BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS courses_year_idx ON courses (year);

CREATE TABLE IF NOT EXISTS lectures (
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  video_data TEXT,
  pdf_data   TEXT,
  position   INTEGER NOT NULL,
  created_at BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lectures_course_position_idx ON lectures (course_id, position);

CREATE TABLE IF NOT EXISTS quizzes (
  id         TEXT PRIMARY KEY,
  lecture_id TEXT NOT NULL UNIQUE REFERENCES lectures(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id                 TEXT PRIMARY KEY,
  quiz_id            TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN ('mcq', 'essay')),
  image_url          TEXT,
  correct_option_id  TEXT,
  position           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_position_idx ON quiz_questions (quiz_id, position);

CREATE TABLE IF NOT EXISTS quiz_options (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  position    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS quiz_options_question_position_idx ON quiz_options (question_id, position);

ALTER TABLE quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_correct_option_fk;
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_correct_option_fk
  FOREIGN KEY (correct_option_id) REFERENCES quiz_options(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS enrollments (
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lecture_id   TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  mcq_score    INTEGER NOT NULL,
  mcq_total    INTEGER NOT NULL,
  essay_total  INTEGER NOT NULL,
  final_score  INTEGER,
  approved     BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_student_lecture_idx ON quiz_attempts (student_id, lecture_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_student_idx ON quiz_attempts (student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS quiz_attempts_lecture_idx ON quiz_attempts (lecture_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id                 TEXT PRIMARY KEY,
  attempt_id         TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id        TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('mcq', 'essay')),
  selected_option_id TEXT,
  method             TEXT,
  text_answer        TEXT,
  image_url          TEXT,
  position           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS quiz_attempt_answers_attempt_position_idx ON quiz_attempt_answers (attempt_id, position);
