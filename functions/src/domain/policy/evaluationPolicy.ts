import {ConstraintResult, Evaluation, Game} from "../model/models";
import {wordCount} from "./gamePolicy";

export const TIMEOUT_MESSAGE = "The evaluation is taking longer than expected. We'll let you know when your results are ready";
export const DETAILED_FEEDBACK_ERROR = "The detailed feedback could not be loaded at this time";
export const RESTRICTION_COMPLIANCE_ERROR = "Compliance with restrictions could not be verified";
export const RESTRICTION_DETAILS_ERROR = "The restriction details could not be loaded";

export function containsWord(text: string, word: string): boolean {
  const escaped = word.normalize("NFKC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text.normalize("NFKC"));
}

export function structureEvaluation(game: Game, result: Evaluation): Evaluation {
  const evaluation = {...result};
  if (![result.spelling, result.vocabulary, result.coherence, result.creativity].every((v) => typeof v === "string" && v.trim())) {
    evaluation.feedbackError = DETAILED_FEEDBACK_ERROR;
  }
  if (!game.challenge) return evaluation;
  const count = wordCount(game.content), max = game.writingMode === "STANDARD" ? 150 : 200;
  const constraints: ConstraintResult[] = [
    {label: `Between 50 and ${max} words`, fulfilled: count >= 50 && count <= max},
    ...game.challenge.words.map((w) => ({label: `Use «${w.text}»`, fulfilled: containsWord(game.content, w.text)})),
  ];
  if (game.challenge.topic) {
    if (typeof result.topicRelevant === "boolean") constraints.push({label: `Topic: ${game.challenge.topic}`, fulfilled: result.topicRelevant});
    else evaluation.constraintsError = RESTRICTION_COMPLIANCE_ERROR;
  }
  for (const rule of game.challenge.advanced ?? []) {
    if (rule === "FIRST_PERSON") constraints.push({label: "Write in first person", fulfilled: /(^|[^\p{L}])(yo|me|mi|nosotros|nosotras|i|my|we|our)([^\p{L}]|$)/iu.test(game.content)});
    else if (rule === "QUESTION") constraints.push({label: "Include a question", fulfilled: /[^.!?\n]+\?/u.test(game.content)});
    else evaluation.constraintsError = RESTRICTION_COMPLIANCE_ERROR;
  }
  return {...evaluation, constraints};
}
