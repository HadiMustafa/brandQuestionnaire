import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";
import ComparisonPanel, { ComparisonIndicators } from './ComparisonPanel';

const AIRTABLE_BASE = import.meta.env.VITE_AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_TABLE_SECTIONS = import.meta.env.VITE_AIRTABLE_TABLE_SECTIONS;
const AIRTABLE_TABLE_QUESTIONS = import.meta.env.VITE_AIRTABLE_TABLE_QUESTIONS;
const AIRTABLE_TABLE_ANSWERS = import.meta.env.VITE_AIRTABLE_TABLE_ANSWERS;
const AIRTABLE_TABLE_USERS = import.meta.env.VITE_AIRTABLE_TABLE_USERS;
const AIRTABLE_TABLE_USER_ANSWERS = import.meta.env.VITE_AIRTABLE_TABLE_USER_ANSWERS;
const AIRTABLE_TABLE_RESULTS = import.meta.env.VITE_AIRTABLE_TABLE_RESULTS;

const airtableAxios = axios.create({
  baseURL: `https://api.airtable.com/v0/${AIRTABLE_BASE}`,
  headers: {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  },
});

function App() {
  const [sections, setSections] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [otherText, setOtherText] = useState({});
  const [otherSelected, setOtherSelected] = useState({});
  const [expandedAnswers, setExpandedAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userAnswerRecords, setUserAnswerRecords] = useState({});
  
  // Login state
  const [showLogin, setShowLogin] = useState(true);
  const [userCode, setUserCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const fetchQuestionsData = async () => {
    // Fetch sections and questions normally
    const [secRes, quesRes] = await Promise.all([
      airtableAxios.get(`/${AIRTABLE_TABLE_SECTIONS}?sort[0][field]=order&sort[0][direction]=asc`),
      airtableAxios.get(`/${AIRTABLE_TABLE_QUESTIONS}?sort[0][field]=order&sort[0][direction]=asc`),
    ]);

    // Fetch ALL answers with pagination
    let allAnswers = [];
    let offset = null;
    
    do {
      const url = offset 
        ? `/${AIRTABLE_TABLE_ANSWERS}?sort[0][field]=order&sort[0][direction]=asc&offset=${offset}`
        : `/${AIRTABLE_TABLE_ANSWERS}?sort[0][field]=order&sort[0][direction]=asc`;
      
      const ansRes = await airtableAxios.get(url);
      allAnswers = [...allAnswers, ...ansRes.data.records];
      offset = ansRes.data.offset;
      
      console.log(`Fetched ${allAnswers.length} answers so far...`);
    } while (offset);

    console.log("Sections:", secRes.data.records);
    console.log("Questions:", quesRes.data.records);
    console.log("Answers (ALL):", allAnswers);
    console.log(`✅ Total answers loaded: ${allAnswers.length}`);

    setSections(secRes.data.records);
    setQuestions(quesRes.data.records);
    setAnswers(allAnswers);
  };

const loadUserAnswers = async (userId) => {
  try {
    console.log("🔍 Starting loadUserAnswers...");
    console.log("🔍 User ID:", userId);
    
    // Fetch ALL user answers (no filter)
    const response = await airtableAxios.get(
      `/${AIRTABLE_TABLE_USER_ANSWERS}`
    );
    
    console.log("📦 Total records fetched:", response.data.records.length);
    
    // Filter manually in JavaScript
    const userRecords = response.data.records.filter(record => {
      const recordUserId = record.fields.user_id?.[0]; // Get linked user record ID
      console.log(`Checking record: user_id = ${recordUserId}, looking for ${userId}`);
      return recordUserId === userId;
    });
    
    console.log("📊 Records found for this user:", userRecords.length);
    
    if (userRecords.length === 0) {
      console.log("⚠️ NO RECORDS FOUND for this user!");
      return;
    }
    
    const userAnswers = {};
    const answerRecords = {};
    const otherTexts = {};
    const otherSelections = {};
    
    userRecords.forEach((record) => {
      const questionId = record.fields.question_id?.[0];
      const answerId = record.fields.answer_id?.[0];
      
      console.log(`Processing: questionId=${questionId}, answerId=${answerId}`);
      
      if (questionId) {
        if (answerId) {
          if (!userAnswers[questionId]) {
            userAnswers[questionId] = [];
          }
          userAnswers[questionId].push(answerId);
          
          if (!answerRecords[questionId]) {
            answerRecords[questionId] = {};
          }
          answerRecords[questionId][answerId] = record.id;
          
          if (record.fields.other_text) {
            otherTexts[questionId] = record.fields.other_text;
          }
        } else {
          // "Other" answer
          if (!userAnswers[questionId]) {
            userAnswers[questionId] = [];
          }
          userAnswers[questionId].push('__other__');
          
          if (!answerRecords[questionId]) {
            answerRecords[questionId] = {};
          }
          answerRecords[questionId].__other__ = record.id;
          
          otherTexts[questionId] = record.fields.other_text || "";
          otherSelections[questionId] = true;
        }
      }
    });
    
    console.log("✅ Final loaded state:");
    console.log("  userAnswers:", userAnswers);
    console.log("  otherSelections:", otherSelections);
    
    setSelectedAnswers(userAnswers);
    setUserAnswerRecords(answerRecords);
    setOtherText(otherTexts);
    setOtherSelected(otherSelections);
    
  } catch (error) {
    console.error("❌ Error loading user answers:", error);
  }
};
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    
    try {
      const response = await airtableAxios.get(
        `/${AIRTABLE_TABLE_USERS}?filterByFormula={code}='${userCode}'`
      );
      
      if (response.data.records.length === 0) {
        setLoginError("Invalid code. Please try again.");
        setLoggingIn(false);
        return;
      }
      
      const user = response.data.records[0];
      setCurrentUser(user);
      
      await fetchQuestionsData();
      await loadUserAnswers(user.id);
      
      setShowLogin(false);
      setLoading(false);
      
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("Error connecting to server. Please try again.");
      setLoggingIn(false);
    }
  };

  const getSectionId = (question) => {
    const sectionField = question.fields.section_id;
    return Array.isArray(sectionField) ? sectionField[0] : sectionField;
  };

  const getQuestionId = (answer) => {
    const questionField = answer.fields.question_id;
    return Array.isArray(questionField) ? questionField[0] : questionField;
  };

  const allowsMultiple = (questionId) => {
    const question = questions.find(q => q.id === questionId);
    return question?.fields.allow_multiple || false;
  };

  const toggleAnswerDetails = (answerId) => {
    setExpandedAnswers(prev => ({
      ...prev,
      [answerId]: !prev[answerId]
    }));
  };

  const saveAnswerToAirtable = async (questionId, answerId, isOtherOption, otherTextValue) => {
    try {
      const existingRecordId = userAnswerRecords[questionId]?.[answerId];
      
      if (existingRecordId) {
        await airtableAxios.patch(`/${AIRTABLE_TABLE_USER_ANSWERS}/${existingRecordId}`, {
          fields: {
            ...(isOtherOption && otherTextValue ? { other_text: otherTextValue } : {}),
          }
        });
        console.log("Updated answer record:", existingRecordId);
      } else {
        const response = await airtableAxios.post(`/${AIRTABLE_TABLE_USER_ANSWERS}`, {
          fields: {
            user_id: [currentUser.id],
            question_id: [questionId],
            answer_id: [answerId],
            ...(isOtherOption && otherTextValue ? { other_text: otherTextValue } : {}),
          }
        });
        
        setUserAnswerRecords(prev => ({
          ...prev,
          [questionId]: {
            ...prev[questionId],
            [answerId]: response.data.id
          }
        }));
        
        console.log("Created answer record:", response.data.id);
      }
    } catch (error) {
      console.error("Error saving answer:", error);
      alert("Error saving answer. Please try again.");
    }
  };

  const deleteAnswerFromAirtable = async (questionId, answerId) => {
    try {
      const recordId = userAnswerRecords[questionId]?.[answerId];
      if (recordId) {
        await airtableAxios.delete(`/${AIRTABLE_TABLE_USER_ANSWERS}/${recordId}`);
        console.log("Deleted answer record:", recordId);
        
        setUserAnswerRecords(prev => {
          const updated = { ...prev };
          if (updated[questionId]) {
            delete updated[questionId][answerId];
          }
          return updated;
        });
      }
    } catch (error) {
      console.error("Error deleting answer:", error);
    }
  };

  const handleAnswerToggle = async (questionId, answerId, isOtherOption) => {
    const allowMultiple = allowsMultiple(questionId);
    const currentSelections = selectedAnswers[questionId] || [];
    const isCurrentlySelected = currentSelections.includes(answerId);

    if (allowMultiple) {
      if (isCurrentlySelected) {
        setSelectedAnswers(prev => ({
          ...prev,
          [questionId]: prev[questionId].filter(id => id !== answerId)
        }));
        await deleteAnswerFromAirtable(questionId, answerId);
        
        if (isOtherOption) {
          setOtherText(prev => {
            const updated = { ...prev };
            delete updated[questionId];
            return updated;
          });
        }
      } else {
        setSelectedAnswers(prev => ({
          ...prev,
          [questionId]: [...currentSelections, answerId]
        }));
        await saveAnswerToAirtable(questionId, answerId, isOtherOption, otherText[questionId]);
      }
    } else {
      if (currentSelections.length > 0 && currentSelections[0] !== answerId) {
        await deleteAnswerFromAirtable(questionId, currentSelections[0]);
      }
      
      setSelectedAnswers(prev => ({
        ...prev,
        [questionId]: [answerId]
      }));
      await saveAnswerToAirtable(questionId, answerId, isOtherOption, otherText[questionId]);
    }
  };

  const handleOtherTextChange = async (questionId, text) => {
    setOtherText(prev => ({
      ...prev,
      [questionId]: text
    }));
    
    const selectedAnswerIds = selectedAnswers[questionId] || [];
    for (const answerId of selectedAnswerIds) {
      const answer = answers.find(a => a.id === answerId);
      if (answer?.fields.is_other_option) {
        await saveAnswerToAirtable(questionId, answerId, true, text);
        break;
      }
    }
  };

  // ✅ ADDED: Handle generic "Other" option (no answer_id in Airtable)
  const handleGenericOtherToggle = async (questionId) => {
    const isCurrentlySelected = otherSelected[questionId];
    
    if (isCurrentlySelected) {
      // Deselecting "Other"
      setOtherSelected(prev => ({
        ...prev,
        [questionId]: false
      }));
      
      // Remove from selectedAnswers for progress tracking
      setSelectedAnswers(prev => ({
        ...prev,
        [questionId]: (prev[questionId] || []).filter(id => id !== '__other__')
      }));
      
      // Delete from Airtable
      await deleteAnswerFromAirtable(questionId, '__other__');
      
      // Clear text
      setOtherText(prev => {
        const updated = { ...prev };
        delete updated[questionId];
        return updated;
      });
    } else {
      // Selecting "Other"
      setOtherSelected(prev => ({
        ...prev,
        [questionId]: true
      }));
      
      // Add to selectedAnswers for progress tracking
      setSelectedAnswers(prev => ({
        ...prev,
        [questionId]: [...(prev[questionId] || []), '__other__']
      }));
      
      // Save to Airtable without answer_id
      try {
        const response = await airtableAxios.post(`/${AIRTABLE_TABLE_USER_ANSWERS}`, {
          fields: {
            user_id: [currentUser.id],
            question_id: [questionId],
            other_text: otherText[questionId] || ""
          }
        });
        
        setUserAnswerRecords(prev => ({
          ...prev,
          [questionId]: {
            ...prev[questionId],
            __other__: response.data.id
          }
        }));
        
        console.log("Created 'Other' answer record:", response.data.id);
      } catch (error) {
        console.error("Error saving 'Other' answer:", error);
      }
    }
  };

  // ✅ ADDED: Update "Other" text in Airtable
  const handleGenericOtherTextChange = async (questionId, text) => {
    setOtherText(prev => ({
      ...prev,
      [questionId]: text
    }));
    
    const recordId = userAnswerRecords[questionId]?.__other__;
    if (recordId) {
      try {
        await airtableAxios.patch(`/${AIRTABLE_TABLE_USER_ANSWERS}/${recordId}`, {
          fields: {
            other_text: text
          }
        });
        console.log("Updated 'Other' text in record:", recordId);
      } catch (error) {
        console.error("Error updating 'Other' text:", error);
      }
    }
  };

const handleSubmit = async () => {
  try {
    const completionPercentage = totalQuestions > 0 
      ? Math.round((answeredCount / totalQuestions) * 100) 
      : 0;
    
    // ✅ GET ALL USER_ANSWER RECORD IDs for linking
    const userAnswerRecordIds = [];
    Object.values(userAnswerRecords).forEach(questionRecords => {
      Object.values(questionRecords).forEach(recordId => {
        if (recordId) {
          userAnswerRecordIds.push(recordId);
        }
      });
    });
    
    // ✅ BUILD JSON SUMMARY OF ALL RESPONSES
    const responsesJson = {};
    
    sections.forEach(section => {
      const sectionQuestions = questions.filter(q => getSectionId(q) === section.id);
      
      if (sectionQuestions.length > 0) {
        const sectionData = {};
        
        sectionQuestions.forEach(question => {
          const userAnswerIds = selectedAnswers[question.id] || [];
          const answerData = [];
          
          userAnswerIds.forEach(answerId => {
            if (answerId === '__other__') {
              answerData.push({
                type: "other",
                text: otherText[question.id] || ""
              });
            } else {
              const answer = answers.find(a => a.id === answerId);
              if (answer) {
                answerData.push({
                  id: answerId,
                  label: answer.fields.option_label,
                  description: answer.fields.option_description || null
                });
              }
            }
          });
          
          sectionData[question.fields.question_text] = {
            question_id: question.id,
            answers: answerData,
            answered: answerData.length > 0
          };
        });
        
        responsesJson[section.fields.title] = sectionData;
      }
    });
    
    console.log("📊 Submitting completion record");
    console.log("  - Linking", userAnswerRecordIds.length, "answer records");
    console.log("  - JSON summary:", responsesJson);
    
    // Save to Results table
    const response = await airtableAxios.post(`/${AIRTABLE_TABLE_RESULTS}`, {
      fields: {
        user_id: [currentUser.id],
        completion_percentage: completionPercentage,
        submitted_at: new Date().toISOString(),
        summary: JSON.stringify(responsesJson, null, 2), // ✅ JSON FORMAT
        user_answers: userAnswerRecordIds // ✅ LINKED RECORDS
      }
    });
    
    console.log("✅ Saved to Results table:", response.data);
    
    alert(`Thank you! Your questionnaire is ${completionPercentage}% complete and has been submitted.`);
    
  } catch (error) {
    console.error("❌ Error submitting to Results table:", error);
    alert("Your answers are saved, but there was an error recording completion. Please contact support.");
  }
};


  const comparison = ComparisonPanel({
    currentUser,
    airtableAxios,
    AIRTABLE_TABLE_USERS,
    AIRTABLE_TABLE_RESULTS,
    AIRTABLE_TABLE_USER_ANSWERS,
    answers
  });

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).filter(
    questionId => selectedAnswers[questionId].length > 0
  ).length;
  const progress = totalQuestions ? (answeredCount / totalQuestions) * 100 : 0;

  if (showLogin) {
    return (
      <div className="login-overlay">
        <div className="login-modal">
          <h1>Brand Direction</h1>
          <p>Please enter your access code to continue</p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              value={userCode}
              onChange={(e) => {
                setUserCode(e.target.value);
                setLoginError("");
              }}
              placeholder="Enter your code"
              className={`login-input ${loginError ? 'error' : ''}`}
              disabled={loggingIn}
              autoFocus
            />
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" disabled={!userCode || loggingIn} className="login-button">
              {loggingIn ? "Verifying..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="app"><h2>Loading...</h2></div>;
  }

  if (error) {
    return (
      <div className="app">
        <h2>Error loading data</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="app">
        <h2>No sections found</h2>
        <p>Please add sections to your Airtable base.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="user-info">
        Welcome, {currentUser?.fields.name || "User"}
      </div>
      
      <h1 className="main-heading">Brand Direction</h1>
      
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
        <div className="progress-text">
          {answeredCount} / {totalQuestions}
        </div>
      </div>


      {/* Comparison Panel */}
      {comparison?.ui}



      {sections.map(section => {
        const sectionQuestions = questions.filter(q => getSectionId(q) === section.id);
        
        if (sectionQuestions.length === 0) return null;
        
        return (
          <div key={section.id} className="section">
            <h2>{section.fields.title}</h2>
            {section.fields.description && (
              <p className="section-description">{section.fields.description}</p>
            )}

            {sectionQuestions.map(question => {
              const questionAnswers = answers.filter(a => getQuestionId(a) === question.id);
              const allowMultiple = question.fields.allow_multiple;
              
              return (
                <div key={question.id} className="question">
                  <h4>{question.fields.question_text}</h4>
                  
                  <div className="answers">
                    {questionAnswers.map(answer => {
                      const isOther = answer.fields.is_other_option;
                      const isSelected = selectedAnswers[question.id]?.includes(answer.id) || false;
                      const hasDetails = answer.fields.option_description;
                      const isExpanded = expandedAnswers[answer.id];
                      
                      // Get comparison users who selected this answer
                      const comparisonUsers = comparison?.getComparisonUsers(question.id, answer.id) || [];
    

                      return (
                        <div key={answer.id} className="answer">
                          <div className="answer-main">
                            <label>
                              <input
                                type={allowMultiple ? "checkbox" : "radio"}
                                name={`question-${question.id}`}
                                checked={isSelected}
                                onChange={() => handleAnswerToggle(question.id, answer.id, isOther)}
                              />
                              <span className="answer-label">{answer.fields.option_label}</span>
                              {/* Comparison Indicators */}
                              {comparison && (
                                <ComparisonIndicators 
                                  userIds={comparisonUsers}
                                  getUserColor={comparison.getUserColor}
                                  getUserName={comparison.getUserName}
                                />
                              )}
                            </label>
                            
                            {hasDetails && (
                              <button
                                className="accordion-toggle"
                                onClick={() => toggleAnswerDetails(answer.id)}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? '−' : '+'}
                              </button>
                            )}
                          </div>
                          
                          {hasDetails && isExpanded && (
                            <div className="answer-detail">
                              {answer.fields.option_description}
                            </div>
                          )}
                          
                          {isOther && isSelected && (
                            <div className="other-input-container">
                              <input
                                type="text"
                                placeholder="Please specify..."
                                value={otherText[question.id] || ""}
                                onChange={(e) => handleOtherTextChange(question.id, e.target.value)}
                                className="other-input"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* ✅ UPDATED: Generic "Other" option with Airtable integration */}
                    {!questionAnswers.some(a => a.fields.is_other_option) && (
                    <div className="answer">
                      <div className="answer-main">
                        <label>
                          <input
                            type={allowMultiple ? "checkbox" : "radio"}
                            name={`question-${question.id}`}
                            checked={otherSelected[question.id] || false}
                            onChange={() => handleGenericOtherToggle(question.id)}
                          />
                          <span className="answer-label">Other</span>
                          
                          {/* Comparison for Other */}
                          {comparison && (
                            <ComparisonIndicators 
                              userIds={comparison?.getOtherComparisonUsers(question.id) || []}
                              getUserColor={comparison.getUserColor}
                              getUserName={comparison.getUserName}
                            />
                          )}
                        </label>
                        </div>
                        
                        {otherSelected[question.id] && (
                          <div className="other-input-container">
                            <input
                              type="text"
                              placeholder="Please specify..."
                              value={otherText[question.id] || ""}
                              onChange={(e) => handleGenericOtherTextChange(question.id, e.target.value)}
                              className="other-input"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="ok-button-container">
        <button onClick={handleSubmit}>
          Complete
        </button>
      </div>
    </div>
  );
}

export default App;