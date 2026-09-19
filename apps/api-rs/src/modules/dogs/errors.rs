//! Dog repository / domain errors.

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("dog name already exists for this owner")]
pub struct DogNameDuplicateError;
