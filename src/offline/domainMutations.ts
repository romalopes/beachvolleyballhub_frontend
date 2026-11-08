import { enqueueOfflineOperation } from "./sync";

export async function queueTrainingParticipantStatus(
  userId: number | string,
  sessionId: number,
  participantId: number,
  status: string,
): Promise<string> {
  return enqueueOfflineOperation({
    userScope: `user:${userId}`,
    domain: "training",
    method: "PATCH",
    endpoint: `/training_sessions/${sessionId}`,
    payload: {
      training_session: {
        training_session_participants_attributes: [{ id: participantId, status }],
      },
    },
  });
}

export async function queueAssessmentScores(
  userId: number | string,
  sessionId: number,
  scores: unknown,
): Promise<string> {
  return enqueueOfflineOperation({
    userScope: `user:${userId}`,
    domain: "assessment",
    method: "PUT",
    endpoint: `/assessment_sessions/${sessionId}/scores`,
    payload: { scores },
  });
}