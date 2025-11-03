import React, { useState, useEffect } from 'react';
import './ComparisonPanel.css';

const ComparisonPanel = ({ 
  currentUser,
  airtableAxios,
  AIRTABLE_TABLE_USERS,
  AIRTABLE_TABLE_RESULTS,
  AIRTABLE_TABLE_USER_ANSWERS,
  answers
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUsersToCompare, setSelectedUsersToCompare] = useState([]);
  const [comparisonData, setComparisonData] = useState({});

  const userColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  ];

  // Fetch all users who have submitted results
  useEffect(() => {
    const fetchAllUsersWithResults = async () => {
      if (!currentUser) return;
      
      try {
        const usersResponse = await airtableAxios.get(`/${AIRTABLE_TABLE_USERS}`);
        const resultsResponse = await airtableAxios.get(`/${AIRTABLE_TABLE_RESULTS}`);
        
        const submittedUserIds = resultsResponse.data.records
          .map(r => r.fields.user_id?.[0])
          .filter(id => id && id !== currentUser.id);
        
        const eligibleUsers = usersResponse.data.records.filter(user => 
          submittedUserIds.includes(user.id) && 
          user.fields.role !== 'admin'
        );
        
        console.log("👥 Users with submitted results:", eligibleUsers);
        setAllUsers(eligibleUsers);
        
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchAllUsersWithResults();
  }, [currentUser]);

  // Fetch comparison data when users are selected
  useEffect(() => {
    const fetchComparisonData = async () => {
      if (selectedUsersToCompare.length === 0) {
        setComparisonData({});
        return;
      }

      try {
        const data = {};
        
        for (const userId of selectedUsersToCompare) {
          const response = await airtableAxios.get(`/${AIRTABLE_TABLE_USER_ANSWERS}`);
          
          const userRecords = response.data.records.filter(record => {
            const recordUserId = record.fields.user_id?.[0];
            return recordUserId === userId;
          });
          
          const userAnswers = {};
          const userOtherText = {};
          const userOtherSelected = {};
          
          userRecords.forEach(record => {
            const questionId = record.fields.question_id?.[0];
            const answerId = record.fields.answer_id?.[0];
            
            if (questionId) {
              if (answerId) {
                if (!userAnswers[questionId]) {
                  userAnswers[questionId] = [];
                }
                userAnswers[questionId].push(answerId);
                
                if (record.fields.other_text) {
                  userOtherText[questionId] = record.fields.other_text;
                }
              } else {
                if (!userAnswers[questionId]) {
                  userAnswers[questionId] = [];
                }
                userAnswers[questionId].push('__other__');
                userOtherText[questionId] = record.fields.other_text || "";
                userOtherSelected[questionId] = true;
              }
            }
          });
          
          data[userId] = {
            answers: userAnswers,
            otherText: userOtherText,
            otherSelected: userOtherSelected
          };
        }
        
        console.log("📊 Comparison data loaded:", data);
        setComparisonData(data);
        
      } catch (error) {
        console.error("Error fetching comparison data:", error);
      }
    };

    fetchComparisonData();
  }, [selectedUsersToCompare]);

  const handleUserComparisonToggle = (userId) => {
    if (selectedUsersToCompare.includes(userId)) {
      setSelectedUsersToCompare(selectedUsersToCompare.filter(id => id !== userId));
    } else {
      if (selectedUsersToCompare.length >= 4) {
        alert("You can compare up to 4 users at a time");
        return;
      }
      setSelectedUsersToCompare([...selectedUsersToCompare, userId]);
    }
  };

  const getUserColor = (userId) => {
    const index = selectedUsersToCompare.indexOf(userId);
    return index >= 0 ? userColors[index % userColors.length] : '#666';
  };

  const getUserName = (userId) => {
    const user = allUsers.find(u => u.id === userId);
    return user?.fields.name || 'Unknown User';
  };

  const getComparisonUsers = (questionId, answerId) => {
    return selectedUsersToCompare.filter(userId => 
      comparisonData[userId]?.answers[questionId]?.includes(answerId)
    );
  };

  const getOtherComparisonUsers = (questionId) => {
    return selectedUsersToCompare.filter(userId => 
      comparisonData[userId]?.otherSelected[questionId]
    );
  };

  if (allUsers.length === 0) return null;

  return {
    // Render the UI
    ui: (
    <div className="comparison-section">
        <div className="comparison-header">
        <h3>Compare with other users</h3>
        <button 
            className="comparison-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Hide comparison" : "Show comparison"}
        >
            {isExpanded ? '−' : '+'}
        </button>
        </div>
        
        {isExpanded && (
        <div className="user-checkboxes">
            {allUsers.map(user => (
            <label 
                key={user.id} 
                className="user-checkbox-label"
                style={{
                borderLeft: selectedUsersToCompare.includes(user.id) 
                    ? `4px solid ${getUserColor(user.id)}` 
                    : '4px solid transparent'
                }}
            >
                <input
                type="checkbox"
                checked={selectedUsersToCompare.includes(user.id)}
                onChange={() => handleUserComparisonToggle(user.id)}
                />
                <span 
                className="user-checkbox-name"
                style={{
                    color: selectedUsersToCompare.includes(user.id) 
                    ? getUserColor(user.id) 
                    : '#666'
                }}
                >
                {user.fields.name}
                </span>
            </label>
            ))}
        </div>
        )}
    </div>
    ),
    // Export helper functions
    getComparisonUsers,
    getOtherComparisonUsers,
    getUserColor,
    getUserName,
    hasComparison: selectedUsersToCompare.length > 0
  };
};

// Component for displaying comparison indicators
export const ComparisonIndicators = ({ userIds, getUserColor, getUserName }) => {
  if (!userIds || userIds.length === 0) return null;
  
  return (
    <span className="comparison-indicators">
      {userIds.map(userId => (
        <span
          key={userId}
          className="comparison-dot"
          style={{ backgroundColor: getUserColor(userId) }}
          title={getUserName(userId)}
        >
          {getUserName(userId).charAt(0)}
        </span>
      ))}
    </span>
  );
};

export default ComparisonPanel;