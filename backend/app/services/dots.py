"""DOTS score calculator for powerlifting."""


def lbs_to_kg(lbs: float) -> float:
    """Convert pounds to kilograms."""
    return round(lbs * 0.453592, 2)


def kg_to_lbs(kg: float) -> float:
    """Convert kilograms to pounds."""
    return round(kg * 2.20462, 2)


def calculate_dots(total_kg: float, bodyweight_kg: float, is_male: bool = True) -> float:
    """Calculate DOTS score.

    DOTS = total_kg * 500 / (a*bw^4 + b*bw^3 + c*bw^2 + d*bw + e)

    Args:
        total_kg: Competition total in kilograms (squat + bench + deadlift).
        bodyweight_kg: Athlete's bodyweight in kilograms.
        is_male: True for male coefficients, False for female.

    Returns:
        DOTS score rounded to 2 decimal places.
    """
    if bodyweight_kg <= 0 or total_kg <= 0:
        return 0.0

    bw = bodyweight_kg

    if is_male:
        # Male coefficients
        a = -0.000001093
        b = 0.0007391293
        c = -0.1918759221
        d = 24.0900756
        e = -307.75076
    else:
        # Female coefficients
        a = -0.0000010706
        b = 0.0005158568
        c = -0.1126655495
        d = 13.6175032
        e = -57.96288

    denominator = a * bw**4 + b * bw**3 + c * bw**2 + d * bw + e
    if denominator <= 0:
        return 0.0

    dots = total_kg * 500 / denominator
    return round(dots, 2)
