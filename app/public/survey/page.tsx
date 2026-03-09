"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star, CheckCircle, Send, Building2, User, Loader2 } from "lucide-react"
import { saveGuestSurvey, getGuestSurveyInfo } from "@/lib/public-actions"
import { useToast } from "@/components/ui/use-toast"

function SurveyForm() {
  const searchParams = useSearchParams()
  const requestId = searchParams.get("requestId")
  const guestId = searchParams.get("guestId")
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [surveyInfo, setSurveyInfo] = useState<{ guestName: string; organization: string; tenantName?: string } | null>(null)
  
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")

  useEffect(() => {
    async function init() {
      if (!requestId || !guestId) {
        setLoading(false)
        return
      }
      const info = await getGuestSurveyInfo(guestId, requestId)
      setSurveyInfo(info)
      setLoading(false)
    }
    init()
  }, [requestId, guestId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!requestId || !guestId) return

    if (rating === 0) {
      toast({
        variant: "destructive",
        title: "Rating Required",
        description: "Please provide a star rating for your visit.",
      })
      return
    }

    setSubmitting(true)
    const result = await saveGuestSurvey({
      requestId,
      guestId,
      rating,
      comment: comment.trim(),
    })

    if (result.success) {
      setSubmitted(true)
    } else {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: result.error || "An error occurred while saving your feedback.",
      })
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
      </div>
    )
  }

  if (!surveyInfo) {
    return (
      <Card className="border-red-100 bg-red-50 p-8 text-center">
        <h2 className="text-xl font-bold text-red-900">Invalid Link</h2>
        <p className="mt-2 text-red-700">
          This feedback link is invalid or has expired. Please contact the organization if you believe this is an error.
        </p>
      </Card>
    )
  }

  if (submitted) {
    return (
      <Card className="animate-in fade-in zoom-in duration-500 p-12 text-center shadow-xl border-t-4 border-t-green-500">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Thank You!</h2>
        <p className="mt-4 text-lg text-gray-600">
          We appreciate you taking the time to share your feedback. Your input helps us improve our visitor experience at <strong>{surveyInfo.tenantName || 'our facility'}</strong>.
        </p>
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold">VMS3 Secure Checkout</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden shadow-2xl border-none ring-1 ring-gray-200">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-700 p-8 text-white">
        <CardTitle className="text-2xl font-bold">Visitor Experience Survey</CardTitle>
        <div className="mt-4 flex flex-wrap gap-4 text-cyan-50">
          <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1 rounded-full">
            <User className="h-4 w-4" />
            {surveyInfo.guestName}
          </div>
          <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1 rounded-full">
            <Building2 className="h-4 w-4" />
            {surveyInfo.organization}
          </div>
        </div>
      </div>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4 text-center">
            <Label className="text-lg font-semibold text-gray-900">
              How would you rate your visit today?
            </Label>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-all hover:scale-125 focus:outline-none"
                >
                  <Star
                    className={`h-12 w-12 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "fill-gray-100 text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="h-6">
              {rating > 0 && (
                <p className="text-sm font-bold text-cyan-700 uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                  {["Poor", "Fair", "Good", "Very Good", "Excellent"][rating - 1]}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="comment" className="text-base font-semibold text-gray-900">
              Tell us more about your experience (Optional)
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you enjoy? What could we do better?"
              rows={4}
              className="resize-none border-gray-200 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <Button 
            type="submit" 
            disabled={submitting || rating === 0}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 py-6 text-lg font-bold shadow-lg transition-all hover:shadow-cyan-200/50 hover:-translate-y-0.5"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Send className="mr-2 h-5 w-5" />
            )}
            Submit Feedback
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function PublicSurveyPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Suspense fallback={
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          </div>
        }>
          <SurveyForm />
        </Suspense>
        
        <p className="mt-8 text-center text-xs text-gray-400">
          Powered by VMS3 &bull; Secure Visitor Management
        </p>
      </div>
    </div>
  )
}
