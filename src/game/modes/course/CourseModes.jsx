import CourseMode from './CourseMode.jsx'

// The course runs that each have a mode of their own (story JSON / Games tab /
// Lagos Online name them by these ids). Each is CourseMode with its course.
export const CreekRunMode = (props) => <CourseMode {...props} id="creekRun" />
export const CustomsBreakoutMode = (props) => <CourseMode {...props} id="customsBreakout" />
export const CartDashMode = (props) => <CourseMode {...props} id="cartDash" />
export const ConvoyEscortMode = (props) => <CourseMode {...props} id="convoyEscort" />
