#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for AI Medicine Reminder & Health Risk Predictor
Tests all endpoints in sequence as requested in the review.
"""

import requests
import json
import sys
from datetime import datetime
import time

# Configuration
BASE_URL = "https://health-shield-hub.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS.copy()
        self.auth_token = None
        self.user_data = None
        self.medicine_ids = []
        self.schedule_ids = []
        self.health_log_ids = []
        self.alert_ids = []
        self.test_results = []
        
    def log_test(self, test_name, success, details="", response_data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data
        })
    
    def make_request(self, method, endpoint, data=None, params=None):
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "PATCH":
                response = requests.patch(url, headers=self.headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return None
    
    def set_auth_token(self, token):
        """Set authentication token for subsequent requests"""
        self.auth_token = token
        self.headers["Authorization"] = f"Bearer {token}"
    
    def test_auth_register(self):
        """Test user registration"""
        print("=== Testing Authentication - Register ===")
        
        user_data = {
            "email": "test@example.com",
            "password": "test123",
            "name": "Test User",
            "age": 30,
            "gender": "male"
        }
        
        response = self.make_request("POST", "/auth/register", user_data)
        
        if response is None:
            self.log_test("POST /auth/register", False, "Request failed - no response")
            return False
        
        if response.status_code == 201 or response.status_code == 200:
            try:
                data = response.json()
                if "token" in data and "user" in data:
                    self.set_auth_token(data["token"])
                    self.user_data = data["user"]
                    self.log_test("POST /auth/register", True, f"User registered successfully with ID: {data['user']['id']}")
                    return True
                else:
                    self.log_test("POST /auth/register", False, "Missing token or user in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("POST /auth/register", False, "Invalid JSON response", response.text)
                return False
        elif response.status_code == 400:
            # User might already exist, try login instead
            self.log_test("POST /auth/register", False, "User already exists (expected)", response.json())
            return self.test_auth_login()
        else:
            self.log_test("POST /auth/register", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_auth_login(self):
        """Test user login"""
        print("=== Testing Authentication - Login ===")
        
        login_data = {
            "email": "test@example.com",
            "password": "test123"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        
        if response is None:
            self.log_test("POST /auth/login", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "token" in data and "user" in data:
                    self.set_auth_token(data["token"])
                    self.user_data = data["user"]
                    self.log_test("POST /auth/login", True, f"Login successful for user: {data['user']['email']}")
                    return True
                else:
                    self.log_test("POST /auth/login", False, "Missing token or user in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("POST /auth/login", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("POST /auth/login", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_auth_me(self):
        """Test get current user info"""
        print("=== Testing Authentication - Get Me ===")
        
        if not self.auth_token:
            self.log_test("GET /auth/me", False, "No auth token available")
            return False
        
        response = self.make_request("GET", "/auth/me")
        
        if response is None:
            self.log_test("GET /auth/me", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "id" in data and "email" in data:
                    self.log_test("GET /auth/me", True, f"User info retrieved: {data['email']}")
                    return True
                else:
                    self.log_test("GET /auth/me", False, "Missing user fields in response", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("GET /auth/me", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("GET /auth/me", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_medicines_create(self):
        """Test creating medicines"""
        print("=== Testing Medicines - Create ===")
        
        if not self.auth_token:
            self.log_test("POST /medicines", False, "No auth token available")
            return False
        
        # Create first medicine
        medicine1 = {
            "name": "Aspirin",
            "dosage": "500mg",
            "timing": ["morning", "night"],
            "frequency": "daily"
        }
        
        response = self.make_request("POST", "/medicines", medicine1)
        
        if response is None:
            self.log_test("POST /medicines (Aspirin)", False, "Request failed - no response")
            return False
        
        success1 = False
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if "id" in data:
                    self.medicine_ids.append(data["id"])
                    self.log_test("POST /medicines (Aspirin)", True, f"Medicine created with ID: {data['id']}")
                    success1 = True
                else:
                    self.log_test("POST /medicines (Aspirin)", False, "Missing ID in response", data)
            except json.JSONDecodeError:
                self.log_test("POST /medicines (Aspirin)", False, "Invalid JSON response", response.text)
        else:
            self.log_test("POST /medicines (Aspirin)", False, f"HTTP {response.status_code}", response.text)
        
        # Create second medicine
        medicine2 = {
            "name": "Metformin",
            "dosage": "850mg",
            "timing": ["morning", "afternoon", "night"],
            "frequency": "daily"
        }
        
        response = self.make_request("POST", "/medicines", medicine2)
        
        success2 = False
        if response and (response.status_code == 200 or response.status_code == 201):
            try:
                data = response.json()
                if "id" in data:
                    self.medicine_ids.append(data["id"])
                    self.log_test("POST /medicines (Metformin)", True, f"Medicine created with ID: {data['id']}")
                    success2 = True
                else:
                    self.log_test("POST /medicines (Metformin)", False, "Missing ID in response", data)
            except json.JSONDecodeError:
                self.log_test("POST /medicines (Metformin)", False, "Invalid JSON response", response.text)
        else:
            self.log_test("POST /medicines (Metformin)", False, f"HTTP {response.status_code if response else 'No response'}", response.text if response else "")
        
        return success1 and success2
    
    def test_medicines_list(self):
        """Test listing medicines"""
        print("=== Testing Medicines - List ===")
        
        if not self.auth_token:
            self.log_test("GET /medicines", False, "No auth token available")
            return False
        
        response = self.make_request("GET", "/medicines")
        
        if response is None:
            self.log_test("GET /medicines", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /medicines", True, f"Retrieved {len(data)} medicines")
                    return True
                else:
                    self.log_test("GET /medicines", False, "Response is not a list", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("GET /medicines", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("GET /medicines", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_medicines_today(self):
        """Test getting today's medicine schedule"""
        print("=== Testing Medicines - Today's Schedule ===")
        
        if not self.auth_token:
            self.log_test("GET /medicines/today", False, "No auth token available")
            return False
        
        response = self.make_request("GET", "/medicines/today")
        
        if response is None:
            self.log_test("GET /medicines/today", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    # Store schedule IDs for later testing
                    for schedule in data:
                        if "id" in schedule:
                            self.schedule_ids.append(schedule["id"])
                    
                    self.log_test("GET /medicines/today", True, f"Retrieved {len(data)} scheduled medicines")
                    return True
                else:
                    self.log_test("GET /medicines/today", False, "Response is not a list", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("GET /medicines/today", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("GET /medicines/today", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_medicine_schedule_update(self):
        """Test marking medicine as taken"""
        print("=== Testing Medicines - Mark as Taken ===")
        
        if not self.auth_token:
            self.log_test("PATCH /medicines/schedule/{id}", False, "No auth token available")
            return False
        
        if not self.schedule_ids:
            self.log_test("PATCH /medicines/schedule/{id}", False, "No schedule IDs available")
            return False
        
        schedule_id = self.schedule_ids[0]
        update_data = {"status": "taken"}
        
        response = self.make_request("PATCH", f"/medicines/schedule/{schedule_id}", update_data)
        
        if response is None:
            self.log_test("PATCH /medicines/schedule/{id}", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                self.log_test("PATCH /medicines/schedule/{id}", True, "Medicine marked as taken successfully")
                return True
            except json.JSONDecodeError:
                self.log_test("PATCH /medicines/schedule/{id}", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("PATCH /medicines/schedule/{id}", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_health_logs_create(self):
        """Test creating health logs"""
        print("=== Testing Health Logs - Create ===")
        
        if not self.auth_token:
            self.log_test("POST /health-logs", False, "No auth token available")
            return False
        
        # Create first health log
        health_log1 = {
            "weight": 75.5,
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "blood_sugar": 95,
            "heart_rate": 72
        }
        
        response = self.make_request("POST", "/health-logs", health_log1)
        
        success1 = False
        if response and (response.status_code == 200 or response.status_code == 201):
            try:
                data = response.json()
                if "id" in data:
                    self.health_log_ids.append(data["id"])
                    self.log_test("POST /health-logs (Normal values)", True, f"Health log created with ID: {data['id']}")
                    success1 = True
                else:
                    self.log_test("POST /health-logs (Normal values)", False, "Missing ID in response", data)
            except json.JSONDecodeError:
                self.log_test("POST /health-logs (Normal values)", False, "Invalid JSON response", response.text)
        else:
            self.log_test("POST /health-logs (Normal values)", False, f"HTTP {response.status_code if response else 'No response'}", response.text if response else "")
        
        # Create second health log with higher values (should trigger alerts)
        health_log2 = {
            "weight": 76,
            "systolic_bp": 145,
            "diastolic_bp": 95,
            "blood_sugar": 150,
            "heart_rate": 85
        }
        
        response = self.make_request("POST", "/health-logs", health_log2)
        
        success2 = False
        if response and (response.status_code == 200 or response.status_code == 201):
            try:
                data = response.json()
                if "id" in data:
                    self.health_log_ids.append(data["id"])
                    self.log_test("POST /health-logs (High values)", True, f"Health log created with ID: {data['id']} - should trigger alerts")
                    success2 = True
                else:
                    self.log_test("POST /health-logs (High values)", False, "Missing ID in response", data)
            except json.JSONDecodeError:
                self.log_test("POST /health-logs (High values)", False, "Invalid JSON response", response.text)
        else:
            self.log_test("POST /health-logs (High values)", False, f"HTTP {response.status_code if response else 'No response'}", response.text if response else "")
        
        return success1 and success2
    
    def test_health_logs_list(self):
        """Test listing health logs"""
        print("=== Testing Health Logs - List ===")
        
        if not self.auth_token:
            self.log_test("GET /health-logs", False, "No auth token available")
            return False
        
        response = self.make_request("GET", "/health-logs", params={"limit": 10})
        
        if response is None:
            self.log_test("GET /health-logs", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /health-logs", True, f"Retrieved {len(data)} health logs")
                    return True
                else:
                    self.log_test("GET /health-logs", False, "Response is not a list", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("GET /health-logs", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("GET /health-logs", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_risk_prediction(self):
        """Test AI risk prediction"""
        print("=== Testing Risk Prediction ===")
        
        if not self.auth_token:
            self.log_test("GET /risk-prediction", False, "No auth token available")
            return False
        
        response = self.make_request("GET", "/risk-prediction")
        
        if response is None:
            self.log_test("GET /risk-prediction", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                required_fields = ["overall_risk_level", "overall_risk_score", "diabetes_risk", "hypertension_risk", "heart_disease_risk", "recommendations"]
                
                if all(field in data for field in required_fields):
                    risk_level = data["overall_risk_level"]
                    risk_score = data["overall_risk_score"]
                    recommendations_count = len(data["recommendations"])
                    
                    self.log_test("GET /risk-prediction", True, f"Risk prediction: {risk_level} (score: {risk_score}), {recommendations_count} recommendations")
                    return True
                else:
                    missing_fields = [field for field in required_fields if field not in data]
                    self.log_test("GET /risk-prediction", False, f"Missing required fields: {missing_fields}", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("GET /risk-prediction", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("GET /risk-prediction", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_alerts_list(self):
        """Test listing alerts"""
        print("=== Testing Alerts - List All ===")
        
        if not self.auth_token:
            self.log_test("GET /alerts", False, "No auth token available")
            return False
        
        response = self.make_request("GET", "/alerts")
        
        if response is None:
            self.log_test("GET /alerts", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    # Store alert IDs for later testing
                    for alert in data:
                        if "id" in alert:
                            self.alert_ids.append(alert["id"])
                    
                    self.log_test("GET /alerts", True, f"Retrieved {len(data)} alerts")
                    return True
                else:
                    self.log_test("GET /alerts", False, "Response is not a list", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("GET /alerts", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("GET /alerts", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_alerts_unread(self):
        """Test listing unread alerts only"""
        print("=== Testing Alerts - Unread Only ===")
        
        if not self.auth_token:
            self.log_test("GET /alerts?unread_only=true", False, "No auth token available")
            return False
        
        response = self.make_request("GET", "/alerts", params={"unread_only": True})
        
        if response is None:
            self.log_test("GET /alerts?unread_only=true", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /alerts?unread_only=true", True, f"Retrieved {len(data)} unread alerts")
                    return True
                else:
                    self.log_test("GET /alerts?unread_only=true", False, "Response is not a list", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("GET /alerts?unread_only=true", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("GET /alerts?unread_only=true", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_alert_mark_read(self):
        """Test marking alert as read"""
        print("=== Testing Alerts - Mark as Read ===")
        
        if not self.auth_token:
            self.log_test("PATCH /alerts/{id}/read", False, "No auth token available")
            return False
        
        if not self.alert_ids:
            self.log_test("PATCH /alerts/{id}/read", False, "No alert IDs available")
            return False
        
        alert_id = self.alert_ids[0]
        response = self.make_request("PATCH", f"/alerts/{alert_id}/read")
        
        if response is None:
            self.log_test("PATCH /alerts/{id}/read", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                self.log_test("PATCH /alerts/{id}/read", True, "Alert marked as read successfully")
                return True
            except json.JSONDecodeError:
                self.log_test("PATCH /alerts/{id}/read", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("PATCH /alerts/{id}/read", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_dashboard(self):
        """Test dashboard endpoint"""
        print("=== Testing Dashboard ===")
        
        if not self.auth_token:
            self.log_test("GET /dashboard", False, "No auth token available")
            return False
        
        response = self.make_request("GET", "/dashboard")
        
        if response is None:
            self.log_test("GET /dashboard", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                required_fields = ["today_medicines", "health_stats", "alerts", "risk_prediction"]
                
                if all(field in data for field in required_fields):
                    medicines_count = len(data["today_medicines"]) if data["today_medicines"] else 0
                    alerts_count = len(data["alerts"]) if data["alerts"] else 0
                    has_health_stats = data["health_stats"] is not None
                    has_risk_prediction = data["risk_prediction"] is not None
                    
                    self.log_test("GET /dashboard", True, f"Dashboard data: {medicines_count} medicines, {alerts_count} alerts, health_stats: {has_health_stats}, risk_prediction: {has_risk_prediction}")
                    return True
                else:
                    missing_fields = [field for field in required_fields if field not in data]
                    self.log_test("GET /dashboard", False, f"Missing required fields: {missing_fields}", data)
                    return False
            except json.JSONDecodeError:
                self.log_test("GET /dashboard", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("GET /dashboard", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_medicine_delete(self):
        """Test deleting a medicine"""
        print("=== Testing Medicines - Delete ===")
        
        if not self.auth_token:
            self.log_test("DELETE /medicines/{id}", False, "No auth token available")
            return False
        
        if not self.medicine_ids:
            self.log_test("DELETE /medicines/{id}", False, "No medicine IDs available")
            return False
        
        medicine_id = self.medicine_ids[0]
        response = self.make_request("DELETE", f"/medicines/{medicine_id}")
        
        if response is None:
            self.log_test("DELETE /medicines/{id}", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                self.log_test("DELETE /medicines/{id}", True, "Medicine deleted successfully")
                return True
            except json.JSONDecodeError:
                self.log_test("DELETE /medicines/{id}", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("DELETE /medicines/{id}", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_alert_delete(self):
        """Test deleting an alert"""
        print("=== Testing Alerts - Delete ===")
        
        if not self.auth_token:
            self.log_test("DELETE /alerts/{id}", False, "No auth token available")
            return False
        
        if not self.alert_ids:
            self.log_test("DELETE /alerts/{id}", False, "No alert IDs available")
            return False
        
        alert_id = self.alert_ids[-1] if len(self.alert_ids) > 1 else self.alert_ids[0]
        response = self.make_request("DELETE", f"/alerts/{alert_id}")
        
        if response is None:
            self.log_test("DELETE /alerts/{id}", False, "Request failed - no response")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                self.log_test("DELETE /alerts/{id}", True, "Alert deleted successfully")
                return True
            except json.JSONDecodeError:
                self.log_test("DELETE /alerts/{id}", False, "Invalid JSON response", response.text)
                return False
        else:
            self.log_test("DELETE /alerts/{id}", False, f"HTTP {response.status_code}", response.text)
            return False
    
    def test_error_cases(self):
        """Test error cases"""
        print("=== Testing Error Cases ===")
        
        # Test invalid credentials
        old_headers = self.headers.copy()
        self.headers["Authorization"] = "Bearer invalid_token"
        
        response = self.make_request("GET", "/auth/me")
        if response and response.status_code == 401:
            self.log_test("Invalid token handling", True, "Correctly rejected invalid token")
        else:
            self.log_test("Invalid token handling", False, f"Expected 401, got {response.status_code if response else 'No response'}")
        
        # Restore headers
        self.headers = old_headers
        
        # Test missing required fields
        response = self.make_request("POST", "/medicines", {"name": "Test"})  # Missing required fields
        if response and response.status_code in [400, 422]:
            self.log_test("Missing fields validation", True, "Correctly rejected incomplete data")
        else:
            self.log_test("Missing fields validation", False, f"Expected 400/422, got {response.status_code if response else 'No response'}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Backend API Testing")
        print("=" * 50)
        
        # Authentication tests
        auth_success = self.test_auth_register() or self.test_auth_login()
        if not auth_success:
            print("❌ Authentication failed - cannot continue with protected endpoints")
            return False
        
        self.test_auth_me()
        
        # Medicine tests
        self.test_medicines_create()
        self.test_medicines_list()
        self.test_medicines_today()
        self.test_medicine_schedule_update()
        
        # Health log tests
        self.test_health_logs_create()
        self.test_health_logs_list()
        
        # Risk prediction test
        self.test_risk_prediction()
        
        # Alert tests
        self.test_alerts_list()
        self.test_alerts_unread()
        self.test_alert_mark_read()
        
        # Dashboard test
        self.test_dashboard()
        
        # Cleanup tests
        self.test_medicine_delete()
        self.test_alert_delete()
        
        # Error case tests
        self.test_error_cases()
        
        # Summary
        print("=" * 50)
        print("🏁 Testing Complete")
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("✅ All tests passed!")
            return True
        else:
            print("❌ Some tests failed")
            failed_tests = [result for result in self.test_results if not result["success"]]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return False

def main():
    """Main function"""
    print("AI Medicine Reminder & Health Risk Predictor - Backend API Testing")
    print(f"Testing against: {BASE_URL}")
    print()
    
    tester = BackendTester()
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()