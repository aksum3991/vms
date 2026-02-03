"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star, CheckCircle, Send, ChevronLeft, ChevronRight } from "lucide-react"
import type { Guest, Survey, Request } from "@/lib/types"
import { getRequests, getSurveys, saveSurvey, getRequestById } from "@/lib/actions"
import { useToast } from "@/components/ui/use-toast"

interface GuestWithRequest extends Guest {
  requestId: string
  requestedBy: string
}

export default function SurveyPage() {
  const { toast } = useToast()
  const [checkedOutGuests, setCheckedOutGuests] = useState<GuestWithRequest[]>([])
  const [selectedGuest, setSelectedGuest] = useState<GuestWithRequest | null>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [completedSurveys, setCompletedSurveys] = useState<Set<string>>(new Set())
  const [recentSurveys, setRecentSurveys] = useState<(Survey & {guest?: Guest, request?: Request})[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(5)

  useEffect(() => {
    loadCheckedOutGuests()
    loadCompletedSurveys()
    loadRecentSurveys()
  }, [])

  const loadCheckedOutGuests = async () => {
    const allRequests = await getRequests()
    const approvedRequests = allRequests.filter((r) => r.status === "approver2-approved")

    const guestList: GuestWithRequest[] = []
    approvedRequests.forEach((request) => {
      request.guests.forEach((guest) => {
        if (guest.checkOutTime) {
          guestList.push({
            ...guest,
            requestId: request.id,
            requestedBy: request.requestedBy,
          })
        }
      })
    })

    setCheckedOutGuests(guestList)
  }

  const loadCompletedSurveys = async () => {
    const surveys = await getSurveys()
    const completed = new Set(surveys.map((s) => `${s.requestId}-${s.guestId}`))
    setCompletedSurveys(completed)
  }

  const loadRecentSurveys = async () => {
    const surveys = await getSurveys()
    const enrichedSurveys = await Promise.all(
        surveys.slice(0, 5).map(async (survey) => {
            const request = await getRequestById(survey.requestId);
            const guest = request?.guests.find((g) => g.id === survey.guestId);
            return { ...survey, guest, request };
        })
    );
    setRecentSurveys(enrichedSurveys)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedGuest) {
      toast({
        variant: "destructive",
        title: "No Guest Selected",
        description: "Please select a guest before submitting feedback.",
      })
      return
    }

    if (rating === 0) {
      toast({
        variant: "destructive",
        title: "Rating Required",
        description: "Please provide a star rating.",
      })
      return
    }

    if (!comment.trim() || comment.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Comment Required",
        description: "Please provide a comment of at least 10 characters.",
      })
      return
    }

    const survey: Omit<Survey, "id" | "submittedAt"> = {
      requestId: selectedGuest.requestId,
      guestId: selectedGuest.id,
      rating,
      comment: comment.trim(),
    }

    await saveSurvey(survey)
    setSubmitted(true)
    await loadCompletedSurveys()
    await loadRecentSurveys()

    setTimeout(() => {
      setSubmitted(false)
      setSelectedGuest(null)
      setRating(0)
      setComment("")
    }, 3000)
  }

  const hasSurvey = (guest: GuestWithRequest) => {
    return completedSurveys.has(`${guest.requestId}-${guest.id}`)
  }

  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentGuests = checkedOutGuests.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(checkedOutGuests.length / itemsPerPage)

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 pb-16">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-3xl font-bold text-cyan-600">Guest Feedback Survey</h1>

        {submitted ? (
          <Card className="p-12 text-center">
            <CheckCircle className="mx-auto mb-4 size-16 text-green-600" />
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Thank You!</h2>
            <p className="text-gray-600">Your feedback has been submitted successfully.</p>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Guest Selection */}
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">Select Guest</h2>
              <div className="space-y-2">
                {checkedOutGuests.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">No guests have checked out yet</p>
                ) : (
                  <>
                    {currentGuests.map((guest) => (
                      <button
                        key={`${guest.requestId}-${guest.id}`}
                        onClick={() => setSelectedGuest(guest)}
                        disabled={hasSurvey(guest)}
                        className={`w-full rounded-lg border p-4 text-left transition-colors ${
                          selectedGuest?.id === guest.id
                            ? "border-blue-600 bg-blue-50"
                            : hasSurvey(guest)
                              ? "cursor-not-allowed border-gray-200 bg-gray-100 opacity-60"
                              : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{guest.name}</p>
                            <p className="text-sm text-gray-600">{guest.organization}</p>
                            <p className="mt-1 text-xs text-gray-500">Requested by: {guest.requestedBy}</p>
                            <p className="text-xs text-gray-500">
                              Checked out: {new Date(guest.checkOutTime!).toLocaleString()}
                            </p>
                          </div>
                          {hasSurvey(guest) && (
                            <div className="ml-2">
                              <CheckCircle className="size-5 text-green-600" />
                              <p className="mt-1 text-xs text-green-600">Completed</p>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}

                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between border-t pt-4">
                        <div className="text-sm text-gray-600">
                          Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* Survey Form */}
            <Card className="p-6">
              {selectedGuest ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <h2 className="mb-2 text-xl font-semibold text-gray-900">Feedback for {selectedGuest.name}</h2>
                    <p className="text-sm text-gray-600">{selectedGuest.organization}</p>
                  </div>

                  <div>
                    <Label className="mb-3 block text-base font-semibold">How would you rate your visit?</Label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className={`size-12 ${
                              star <= (hoverRating || rating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-gray-200 text-gray-200"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <p className="mt-2 text-sm font-medium text-gray-700">
                        {rating === 1 && "Poor"}
                        {rating === 2 && "Fair"}
                        {rating === 3 && "Good"}
                        {rating === 4 && "Very Good"}
                        {rating === 5 && "Excellent"}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="comment" className="mb-2 block text-base font-semibold">
                      Please share your experience
                    </Label>
                    <Textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us about your visit, what went well, and what could be improved..."
                      rows={6}
                      required
                      className="resize-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Your feedback helps us improve our services. Minimum 10 characters.
                    </p>
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                    <Send className="mr-2 size-5" />
                    Submit Feedback
                  </Button>
                </form>
              ) : (
                <div className="flex h-full items-center justify-center py-12">
                  <div className="text-center">
                    <Star className="mx-auto mb-4 size-16 text-gray-300" />
                    <p className="text-gray-500">Select a guest to provide feedback</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Survey Statistics */}
        {!submitted && (
          <Card className="mt-6 p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Submitted Surveys</h3>
            <div className="space-y-3">
              {recentSurveys.length === 0 ? (
                <p className="text-center text-sm text-gray-500">No surveys submitted yet</p>
              ) : (
                recentSurveys.map((survey) => (
                    <div key={survey.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{survey.guest?.name || 'Guest Survey'}</p>
                          <div className="mt-1 flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`size-4 ${
                                  star <= survey.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "fill-gray-200 text-gray-200"
                                }`}
                              />
                            ))}
                            <span className="ml-2 text-sm text-gray-600">({survey.rating}/5)</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">{survey.comment}</p>
                          <p className="mt-2 text-xs text-gray-500">
                            Submitted: {new Date(survey.submittedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
