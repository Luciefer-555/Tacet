"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { usePrepProgress } from "@/components/providers/prep-progress-provider"
import { MCQDisplay } from "@/components/mcq/MCQDisplay"

const SUBJECT_OPTIONS = [
  "Data Structures",
  "Algorithms",
  "Operating Systems",
  "Database Management",
  "Computer Networks",
  "Software Engineering",
  "Aptitude",
  "HR & Behavioural",
  "Domain Specific",
]

const QUESTION_TYPES = ["HR", "DSA", "ADA", "Aptitude", "Domain Specific", "System Design"]
const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard"]

// Available categories from our generated MCQs
const MCQ_CATEGORIES = [
  "DSA",
  "Python",
  "JavaScript",
  "React.js",
  "Java",
  "SQL",
  "MongoDB",
  "CSS",
  "System Design",
  "Computer Science"
]

interface PreparationProfile {
  interests: string
  favoriteSubjects: string[]
  goal: string
  companies: string
  focusArea: string
  cgpa: string
  notes: string
}

interface QuestionDoc {
  _id?: string
  id?: string
  title?: string
  question?: string
  prompt?: string
  description?: string
  body?: string
  difficulty?: string
  companyFocus?: string[] | string
  domain?: string | string[]
  subject?: string
  subjects?: string[]
  questionType?: string
  type?: string
  category?: string
  topics?: string[]
  explanation?: string
  answer?: string
}

function normalizeCompany(companyFocus?: QuestionDoc["companyFocus"]): string[] {
  if (!companyFocus) return []
  if (Array.isArray(companyFocus)) return companyFocus.filter(Boolean)
  return companyFocus.split(",").map((value) => value.trim()).filter(Boolean)
}

function getQuestionTitle(question: QuestionDoc) {
  return (
    question.title ||
    question.question ||
    question.prompt ||
    question.description ||
    "Untitled Question"
  )
}

function getQuestionBody(question: QuestionDoc) {
  return question.description || question.body || question.prompt || ""
}

function getQuestionType(question: QuestionDoc) {
  return question.questionType || question.type || question.category || "General"
}

export default function Prep() {
  // Original state
  const [profile, setProfile] = useState<PreparationProfile>({
    interests: "",
    favoriteSubjects: ["Data Structures", "Algorithms"],
    goal: "",
    companies: "",
    focusArea: "",
    cgpa: "",
    notes: "",
  })
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<string>("")
  const [selectedType, setSelectedType] = useState<string>("")
  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("")
  const [questions, setQuestions] = useState<QuestionDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // MCQ specific state
  const [mcqCategory, setMcqCategory] = useState<string>("DSA")
  const [mcqDifficulty, setMcqDifficulty] = useState<string>("")
  const [mcqQuestions, setMcqQuestions] = useState<any[]>([])
  const [isLoadingMcqs, setIsLoadingMcqs] = useState(false)
  const [mcqError, setMcqError] = useState<string | null>(null)
  const [quizStarted, setQuizStarted] = useState(false)
  const [questionsPerQuiz, setQuestionsPerQuiz] = useState(10)

  const {
    recordSolvedQuestion,
    isQuestionSolved,
    solvedCount,
    countsByDifficulty,
    countsByType,
  } = usePrepProgress()

  const favoriteSubjects = profile.favoriteSubjects
  const companyList = useMemo(() => {
    return profile.companies
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  }, [profile.companies])

  // Load MCQ questions
  const loadMcqQuestions = async () => {
    try {
      setIsLoadingMcqs(true)
      setMcqError(null)
      
      // In a real app, you would fetch this from your API
      // For now, we'll use the generated JSON files
      const response = await fetch(`/api/mcqs/${mcqCategory.toLowerCase()}`)
      if (!response.ok) {
        throw new Error(`Failed to load ${mcqCategory} questions`)
      }
      
      const data = await response.json()
      let questions = data.questions || []
      
      // Filter by difficulty if selected
      if (mcqDifficulty) {
        questions = questions.filter((q: any) => q.difficulty === mcqDifficulty)
      }
      
      // Shuffle and take the first N questions
      const shuffled = [...questions].sort(() => 0.5 - Math.random())
      setMcqQuestions(shuffled.slice(0, Math.min(questionsPerQuiz, shuffled.length)))
      setQuizStarted(true)
    } catch (err) {
      console.error("Error loading MCQs:", err)
      setMcqError(err instanceof Error ? err.message : "Failed to load questions")
    } finally {
      setIsLoadingMcqs(false)
    }
  }

  const handleMcqComplete = (score: number, total: number) => {
    // You can add logic here to save the quiz results
    console.log(`Quiz completed! Score: ${score}/${total}`)
  }

  // Original question loading logic
  useEffect(() => {
    if (!isSubmitted) return

    const controller = new AbortController()

    async function loadQuestions() {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()

        const subjectQuery = selectedSubject || favoriteSubjects[0]
        if (subjectQuery) {
          params.append("subject", subjectQuery)
        }

        if (selectedType) {
          params.append("questionType", selectedType)
        }

        if (selectedCompany) {
          params.append("company", selectedCompany)
        }

        if (selectedDifficulty) {
          params.append("difficulty", selectedDifficulty)
        }

        const response = await fetch(`/api/questions?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Failed to fetch questions")
        }

        const data = await response.json()
        setQuestions(data.questions || [])
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError("Failed to load questions. Please try again later.")
          console.error(err)
        }
      } finally {
        setLoading(false)
      }
    }

    loadQuestions()

    return () => {
      controller.abort()
    }
  }, [isSubmitted, selectedSubject, selectedType, selectedCompany, selectedDifficulty, favoriteSubjects])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitted(true)
  }

  const handleProfileChange = (field: keyof PreparationProfile, value: any) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const toggleFavoriteSubject = (subject: string) => {
    setProfile((prev) => {
      const newFavorites = prev.favoriteSubjects.includes(subject)
        ? prev.favoriteSubjects.filter((s) => s !== subject)
        : [...prev.favoriteSubjects, subject]
      return { ...prev, favoriteSubjects: newFavorites }
    })
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="bg-gray-900/80 border border-gray-700">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-white">Your Preparation Profile</CardTitle>
          <CardDescription className="text-gray-400">
            Tell us about your goals and interests to get personalized recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal" className="text-gray-300">
              What's your primary goal?
            </Label>
            <Select
              value={profile.goal}
              onValueChange={(value) => handleProfileChange("goal", value)}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Select your goal" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="internship">Get an Internship</SelectItem>
                <SelectItem value="placement">Campus Placement</SelectItem>
                <SelectItem value="jobChange">Job Change</SelectItem>
                <SelectItem value="learning">Learning & Upskilling</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Your Favorite Subjects</Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_OPTIONS.map((subject) => (
                <Button
                  key={subject}
                  type="button"
                  variant={profile.favoriteSubjects.includes(subject) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleFavoriteSubject(subject)}
                  className={`${
                    profile.favoriteSubjects.includes(subject)
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-200"
                  }`}
                >
                  {subject}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companies" className="text-gray-300">
              Target Companies (comma separated)
            </Label>
            <Input
              id="companies"
              value={profile.companies}
              onChange={(e) => handleProfileChange("companies", e.target.value)}
              placeholder="e.g., Google, Microsoft, Amazon"
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="focusArea" className="text-gray-300">
                Focus Area / Role
              </Label>
              <Input
                id="focusArea"
                value={profile.focusArea}
                onChange={(e) => handleProfileChange("focusArea", e.target.value)}
                placeholder="e.g., Full Stack Developer, Data Scientist"
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cgpa" className="text-gray-300">
                Current CGPA / % (if applicable)
              </Label>
              <Input
                id="cgpa"
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={profile.cgpa}
                onChange={(e) => handleProfileChange("cgpa", e.target.value)}
                placeholder="e.g., 8.5"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-gray-300">
              Additional Notes (optional)
            </Label>
            <Textarea
              id="notes"
              value={profile.notes}
              onChange={(e) => handleProfileChange("notes", e.target.value)}
              placeholder="Any specific topics you want to focus on?"
              className="min-h-[100px] bg-gray-800 border-gray-700 text-white placeholder-gray-500"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            Start Preparing
          </Button>
        </CardFooter>
      </Card>
    </form>
  )

  const renderFilters = () => (
    <Card className="bg-gray-900/80 border border-gray-700">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-white">Filter Questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-gray-300">
              Subject
            </Label>
            <Select
              value={selectedSubject}
              onValueChange={setSelectedSubject}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="">All Subjects</SelectItem>
                {favoriteSubjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type" className="text-gray-300">
              Type
            </Label>
            <Select
              value={selectedType}
              onValueChange={setSelectedType}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="">All Types</SelectItem>
                {QUESTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty" className="text-gray-300">
              Difficulty
            </Label>
            <Select
              value={selectedDifficulty}
              onValueChange={setSelectedDifficulty}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="All Difficulties" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="">All Difficulties</SelectItem>
                {DIFFICULTY_OPTIONS.map((difficulty) => (
                  <SelectItem key={difficulty} value={difficulty}>
                    {difficulty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const renderQuestionCard = (question: QuestionDoc) => {
    const questionId = question._id || question.id || ""
    const isExpanded = expanded[questionId]
    const isSolved = isQuestionSolved(questionId)
    const companies = normalizeCompany(question.companyFocus)
    const difficulty = question.difficulty?.toLowerCase() || "unknown"

    return (
      <Card 
        key={questionId} 
        className={`bg-gray-900/80 border ${
          isSolved ? "border-green-500/30" : "border-gray-700"
        } hover:border-gray-600 transition-colors`}
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-lg font-medium text-white">
                {getQuestionTitle(question)}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                {question.difficulty && (
                  <Badge 
                    variant={difficulty === "hard" ? "destructive" : difficulty === "medium" ? "outline" : "default"}
                    className="capitalize"
                  >
                    {question.difficulty}
                  </Badge>
                )}
                <Badge variant="outline" className="text-gray-300 border-gray-600">
                  {getQuestionType(question)}
                </Badge>
                {companies.map((company) => (
                  <Badge key={company} variant="outline" className="text-blue-300 border-blue-900">
                    {company}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isSolved && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Solved
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:bg-gray-800 hover:text-white"
                onClick={() => toggleExpand(questionId)}
              >
                {isExpanded ? "Hide" : "View Details"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0">
            <div className="prose prose-invert max-w-none text-gray-300">
              <p>{getQuestionBody(question)}</p>
            </div>
            {(question.explanation || question.answer) && (
              <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Explanation</h4>
                <p className="text-sm text-gray-400">
                  {question.explanation || question.answer}
                </p>
              </div>
            )}
            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-400">
                {question.topics?.map((topic) => (
                  <Badge key={topic} variant="outline" className="mr-2 mb-2 bg-gray-800/50 border-gray-700 text-gray-300">
                    {topic}
                  </Badge>
                ))}
              </div>
              <Button
                variant={isSolved ? "outline" : "default"}
                size="sm"
                onClick={() => recordSolvedQuestion({ 
                  id: questionId, 
                  title: getQuestionTitle(question), 
                  difficulty: question.difficulty, 
                  subject: question.subject, 
                  questionType: getQuestionType(question),
                  companies: normalizeCompany(question.companyFocus),
                  domain: question.domain || []
                })}
                className={isSolved ? "text-green-400 border-green-500/30 hover:bg-green-500/10" : ""}
              >
                {isSolved ? "Mark as Unsolved" : "Mark as Solved"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const renderQuestionList = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )
    }

    if (error) {
      return (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="pt-6 text-red-300">
            <p>{error}</p>
          </CardContent>
        </Card>
      )
    }

    if (questions.length === 0) {
      return (
        <Card className="bg-gray-900/50 border-gray-700">
          <CardContent className="pt-6 text-center text-gray-400">
            <p>No questions found matching your filters. Try adjusting your criteria.</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {questions.map((question) => renderQuestionCard(question))}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Interview Preparation</h1>
          <p className="text-muted-foreground">
            Track your preparation progress and practice questions
          </p>
        </div>
        
        <Tabs defaultValue="mcq" className="space-y-4">
          <TabsList className="bg-gray-900/50 border border-gray-700">
            <TabsTrigger 
              value="mcq" 
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-white"
            >
              MCQ Practice
            </TabsTrigger>
            <TabsTrigger 
              value="prep" 
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-white"
            >
              Preparation Tracker
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="mcq" className="space-y-4">
            <Card className="bg-gray-900/80 border border-gray-700">
              <CardHeader>
                <CardTitle className="text-xl text-white">MCQ Practice</CardTitle>
                <CardDescription className="text-gray-400">
                  Test your knowledge with multiple choice questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!quizStarted ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mcq-category" className="text-gray-300">Category</Label>
                        <Select 
                          value={mcqCategory} 
                          onValueChange={setMcqCategory}
                          disabled={isLoadingMcqs}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            {MCQ_CATEGORIES.map((category) => (
                              <SelectItem 
                                key={category} 
                                value={category}
                                className="hover:bg-gray-700"
                              >
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mcq-difficulty" className="text-gray-300">
                          Difficulty (Optional)
                        </Label>
                        <Select 
                          value={mcqDifficulty} 
                          onValueChange={setMcqDifficulty}
                          disabled={isLoadingMcqs}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                            <SelectValue placeholder="All difficulties" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="" className="hover:bg-gray-700">All Difficulties</SelectItem>
                            <SelectItem value="Easy" className="hover:bg-gray-700">Easy</SelectItem>
                            <SelectItem value="Medium" className="hover:bg-gray-700">Medium</SelectItem>
                            <SelectItem value="Hard" className="hover:bg-gray-700">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="questions-count" className="text-gray-300">
                        Number of Questions
                      </Label>
                      <Select 
                        value={questionsPerQuiz.toString()} 
                        onValueChange={(value) => setQuestionsPerQuiz(parseInt(value))}
                        disabled={isLoadingMcqs}
                      >
                        <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
                          <SelectValue placeholder="Number of questions" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="5" className="hover:bg-gray-700">5 Questions</SelectItem>
                          <SelectItem value="10" className="hover:bg-gray-700">10 Questions</SelectItem>
                          <SelectItem value="20" className="hover:bg-gray-700">20 Questions</SelectItem>
                          <SelectItem value="50" className="hover:bg-gray-700">50 Questions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      onClick={loadMcqQuestions} 
                      disabled={isLoadingMcqs}
                      className="mt-4 bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoadingMcqs ? 'Loading...' : 'Start Quiz'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-white">{mcqCategory} Quiz</h3>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setQuizStarted(false)
                          setMcqQuestions([])
                        }}
                        className="text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
                      >
                        Change Settings
                      </Button>
                    </div>
                    
                    {mcqError ? (
                      <div className="text-red-400 p-4 bg-red-900/20 rounded-lg">
                        {mcqError}
                      </div>
                    ) : (
                      <MCQDisplay 
                        questions={mcqQuestions} 
                        onComplete={handleMcqComplete} 
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="prep" className="space-y-4">
            {!isSubmitted ? (
              renderForm()
            ) : (
              <div className="space-y-6">
                <Card className="bg-gray-900/80 border border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">Your Prep Profile</CardTitle>
                    <CardDescription className="text-gray-400">
                      Track your progress and performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-gray-300">
                    <div className="flex flex-wrap gap-2">
                      {favoriteSubjects.map((subject) => (
                        <Badge key={subject} variant="outline" className="bg-blue-900/20 text-blue-300 border-blue-800/50">
                          {subject}
                        </Badge>
                      ))}
                      {companyList.length > 0 && (
                        <div className="flex items-center text-sm text-gray-400">
                          <span className="mr-2">•</span>
                          <span>Targeting: {companyList.join(", ")}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-white">Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-white">{solvedCount}</div>
                          <p className="text-sm text-gray-400">Questions Solved</p>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-white">By Difficulty</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          {Object.entries(countsByDifficulty).map(([difficulty, count]) => (
                            <div key={difficulty} className="flex justify-between items-center">
                              <span className="text-sm text-gray-300 capitalize">{difficulty}</span>
                              <span className="font-medium text-white">{count}</span>
                            </div>
                          ))}
                          {Object.keys(countsByDifficulty).length === 0 && (
                            <p className="text-sm text-gray-400">No data yet</p>
                          )}
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-gray-800/50 border-gray-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-white">By Type</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          {Object.entries(countsByType).map(([type, count]) => (
                            <div key={type} className="flex justify-between items-center">
                              <span className="text-sm text-gray-300">{type}</span>
                              <span className="font-medium text-white">{count}</span>
                            </div>
                          ))}
                          {Object.keys(countsByType).length === 0 && (
                            <p className="text-sm text-gray-400">No data yet</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
                
                {renderFilters()}
                {renderQuestionList()}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
