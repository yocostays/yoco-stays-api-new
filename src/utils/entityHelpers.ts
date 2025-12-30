import UserService from "../services/user.service";
import StaffService from "../services/staff.service";
import { ERROR_MESSAGES } from "./messages";
import { validateObjectId } from "./validationHelpers";

const { RECORD_NOT_FOUND } = ERROR_MESSAGES;
const { getStudentById } = UserService;
const { getStaffById } = StaffService;

// Retrieves and validates a student by ID

export const getValidatedStudent = async (studentId: string) => {
  validateObjectId(studentId);
  const { student } = await getStudentById(studentId);
  if (!student) {
    throw new Error(RECORD_NOT_FOUND("Student"));
  }
  return student;
};

// Retrieves and validates a staff member by ID

export const getValidatedStaff = async (staffId: string) => {
  validateObjectId(staffId);
  const { staff } = await getStaffById(staffId);
  if (!staff) {
    throw new Error(RECORD_NOT_FOUND("Staff"));
  }
  return staff;
};
